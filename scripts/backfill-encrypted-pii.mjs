import { createHash, createCipheriv, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const BATCH_SIZE = 200
const ENCRYPTED_PREFIX = 'enc'
const KEY_VERSION = (process.env.PII_KEY_VERSION || 'v1').trim()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY?.trim()
const PII_KEY = process.env.PII_ENCRYPTION_KEY?.trim()

if (!SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
if (!SUPABASE_SECRET_KEY) throw new Error('Missing SUPABASE_SECRET_KEY')
if (!PII_KEY) throw new Error('Missing PII_ENCRYPTION_KEY')

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const PEOPLE_PROTECTED_FIELDS = [
  'email',
  'cell_phone',
  'home_phone',
  'other_phone',
  'address_line_1',
  'address_line_2',
  'city',
  'state_province',
  'postal_code',
  'country_code',
]
const PEOPLE_HASH_ONLY_FIELDS = ['birth_date']
const PROFILE_CHANGE_FIELDS = ['proposed_email', 'proposed_cell_phone', 'proposed_home_phone']

function keyMaterial() { return createHash('sha256').update(PII_KEY).digest() }
function normalizeText(value) { if (value == null) return null; const text = String(value).trim(); return text || null }
function normalizeEmail(value) { const normalized = normalizeText(value); return normalized ? normalized.toLowerCase() : null }
function normalizePhone(value) { return normalizeText(value) }
function normalizePhoneHash(value) { const normalized = normalizePhone(value); if (!normalized) return null; const digits = normalized.replace(/\D+/g, ''); return digits || normalized.toLowerCase() }
function normalizePostalCode(value) { const normalized = normalizeText(value); return normalized ? normalized.replace(/\s+/g, '').toUpperCase() : null }
function normalizeGeneric(value) { const normalized = normalizeText(value); return normalized ? normalized.toLowerCase() : null }
function hashValue(value) { return value ? createHash('sha256').update(value).digest('hex') : null }
function encryptString(value) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyMaterial(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [ENCRYPTED_PREFIX, KEY_VERSION, iv.toString('base64url'), authTag.toString('base64url'), encrypted.toString('base64url')].join(':')
}
function looksEncrypted(value) { return typeof value === 'string' && value.startsWith(`${ENCRYPTED_PREFIX}:`) }
function hashInputForField(field, value) {
  if (!value) return null
  switch (field) {
    case 'email':
    case 'proposed_email': return normalizeEmail(value)
    case 'cell_phone':
    case 'home_phone':
    case 'other_phone':
    case 'proposed_cell_phone':
    case 'proposed_home_phone': return normalizePhoneHash(value)
    case 'postal_code': return normalizePostalCode(value)
    case 'birth_date': return normalizeText(value)
    default: return normalizeGeneric(value)
  }
}
function storageValueForField(field, value) {
  switch (field) {
    case 'email':
    case 'proposed_email': return normalizeEmail(value)
    case 'cell_phone':
    case 'home_phone':
    case 'other_phone':
    case 'proposed_cell_phone':
    case 'proposed_home_phone': return normalizePhone(value)
    default: return value
  }
}
function transformRow(row, encryptedFields, hashOnlyFields) {
  const patch = {}
  let changed = false
  let anyEncrypted = false

  for (const field of encryptedFields) {
    const current = normalizeText(row[field])
    const normalized = storageValueForField(field, current)
    const hashColumn = `${field}_hash`
    const nextHash = hashValue(hashInputForField(field, normalized))
    if (normalized && !looksEncrypted(row[field])) { patch[field] = encryptString(normalized); changed = true; anyEncrypted = true }
    if ((row[hashColumn] || null) !== nextHash) { patch[hashColumn] = nextHash; changed = true }
    if (looksEncrypted(row[field])) anyEncrypted = true
  }

  for (const field of hashOnlyFields) {
    const normalized = normalizeText(row[field])
    const hashColumn = `${field}_hash`
    const nextHash = hashValue(hashInputForField(field, normalized))
    if ((row[field] || null) !== normalized) { patch[field] = normalized; changed = true }
    if ((row[hashColumn] || null) !== nextHash) { patch[hashColumn] = nextHash; changed = true }
  }

  if (anyEncrypted && row.pii_key_version !== KEY_VERSION) { patch.pii_key_version = KEY_VERSION; changed = true }
  return changed ? patch : null
}
async function processTable({ table, encryptedFields, hashOnlyFields, selectColumns }) {
  let from = 0, updated = 0, scanned = 0
  while (true) {
    const { data, error } = await supabase.from(table).select(selectColumns).order('id', { ascending: true }).range(from, from + BATCH_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const row of data) {
      scanned += 1
      const patch = transformRow(row, encryptedFields, hashOnlyFields)
      if (!patch) continue
      const { error: updateError } = await supabase.from(table).update(patch).eq('id', row.id)
      if (updateError) throw new Error(`${table}:${row.id} -> ${updateError.message}`)
      updated += 1
    }
    from += data.length
  }
  return { scanned, updated }
}

const peopleFields = [...PEOPLE_PROTECTED_FIELDS, ...PEOPLE_HASH_ONLY_FIELDS]
const peopleResult = await processTable({ table: 'people', encryptedFields: PEOPLE_PROTECTED_FIELDS, hashOnlyFields: PEOPLE_HASH_ONLY_FIELDS, selectColumns: ['id', 'pii_key_version', ...peopleFields, ...peopleFields.map((field) => `${field}_hash`)].join(', ') })
const changeRequestResult = await processTable({ table: 'person_profile_change_requests', encryptedFields: PROFILE_CHANGE_FIELDS, hashOnlyFields: [], selectColumns: ['id', 'pii_key_version', ...PROFILE_CHANGE_FIELDS, ...PROFILE_CHANGE_FIELDS.map((field) => `${field}_hash`)].join(', ') })
console.log(JSON.stringify({ people: peopleResult, person_profile_change_requests: changeRequestResult }, null, 2))
