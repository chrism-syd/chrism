import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
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

const args = process.argv.slice(2)
const councilIdIndex = args.indexOf('--council-id')
const councilId = councilIdIndex >= 0 ? args[councilIdIndex + 1]?.trim() : ''
const dryRun = args.includes('--dry-run')

if (!councilId) {
  throw new Error('Usage: node --env-file=.env.local scripts/backfill-supreme-import-text-case.mjs --council-id <uuid> [--dry-run]')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const UPPERCASE_WORDS = new Set([
  'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
  'NW', 'NE', 'SW', 'SE', 'PO', 'RR', 'RPO', 'US', 'UK',
  'QC', 'ON', 'BC', 'AB', 'MB', 'SK', 'NB', 'NS', 'NL', 'PE', 'NT', 'NU', 'YT',
])
const SUFFIX_MAP = { JR: 'Jr.', SR: 'Sr.' }

function keyMaterial() {
  return createHash('sha256').update(PII_KEY).digest()
}

function hashValue(value) {
  return value ? createHash('sha256').update(value).digest('hex') : null
}

function encryptString(value) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyMaterial(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [ENCRYPTED_PREFIX, KEY_VERSION, iv.toString('base64url'), authTag.toString('base64url'), encrypted.toString('base64url')].join(':')
}

function decryptString(value) {
  if (typeof value !== 'string' || !value.startsWith(`${ENCRYPTED_PREFIX}:`)) {
    return value ?? null
  }

  const [prefix, version, iv, authTag, encrypted] = value.split(':')
  if (prefix !== ENCRYPTED_PREFIX || !version || !iv || !authTag || !encrypted) {
    throw new Error('Invalid encrypted value format')
  }

  const decipher = createDecipheriv('aes-256-gcm', keyMaterial(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(authTag, 'base64url'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

function normalizeWhitespace(value) {
  if (value == null) return null
  const normalized = String(value).replace(/\s+/g, ' ').trim()
  return normalized || null
}

function titleCaseToken(token) {
  if (!token) return token
  const upperToken = token.toUpperCase()
  if (UPPERCASE_WORDS.has(upperToken)) return upperToken

  const ordinalMatch = token.match(/^(\d+)([A-Z]{2})$/i)
  if (ordinalMatch) {
    return `${ordinalMatch[1]}${ordinalMatch[2].toLowerCase()}`
  }

  let titled = token.toLowerCase()
  titled = titled.charAt(0).toUpperCase() + titled.slice(1)
  titled = titled.replace(/(^|['’])([a-z])/g, (_match, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
  titled = titled.replace(/\bMc([a-z])/g, (_match, letter) => `Mc${letter.toUpperCase()}`)
  titled = titled.replace(/\bMac([a-z])/g, (_match, letter) => `Mac${letter.toUpperCase()}`)
  return titled
}

function smartTitleCase(value) {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .split(/(\s+)/)
    .map((segment) => {
      if (/^\s+$/.test(segment)) return segment
      return segment
        .split(/([-\/])/)
        .map((part) => {
          if (part === '-' || part === '/') return part
          return titleCaseToken(part)
        })
        .join('')
    })
    .join('')
}

function normalizeTitle(value) {
  const normalized = smartTitleCase(value)
  if (!normalized) return null
  return SUFFIX_MAP[normalized.toUpperCase().replace(/\./g, '')] ?? normalized
}

function normalizeSuffix(value) {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  const upperValue = normalized.toUpperCase().replace(/\./g, '')
  if (SUFFIX_MAP[upperValue]) return SUFFIX_MAP[upperValue]
  if (UPPERCASE_WORDS.has(upperValue)) return upperValue
  return smartTitleCase(normalized)
}

function normalizeStateProvince(value) {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  const collapsed = normalized.replace(/\./g, '')
  if (/^[A-Za-z]{2,3}$/.test(collapsed)) return collapsed.toUpperCase()
  return smartTitleCase(normalized)
}

function normalizePostalCode(value) {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  const compact = normalized.replace(/\s+/g, '').toUpperCase()
  if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact)) {
    return `${compact.slice(0, 3)} ${compact.slice(3)}`
  }
  return compact
}

function normalizeField(field, value) {
  switch (field) {
    case 'title':
      return normalizeTitle(value)
    case 'first_name':
    case 'middle_name':
    case 'last_name':
    case 'address_line_1':
    case 'city':
    case 'member_type':
    case 'member_class':
      return smartTitleCase(value)
    case 'suffix':
      return normalizeSuffix(value)
    case 'email': {
      const normalized = normalizeWhitespace(value)
      return normalized ? normalized.toLowerCase() : null
    }
    case 'state_province':
      return normalizeStateProvince(value)
    case 'postal_code':
      return normalizePostalCode(value)
    default:
      return normalizeWhitespace(value)
  }
}

function normalizePhone(value) {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

function normalizePhoneHash(value) {
  const normalized = normalizePhone(value)
  if (!normalized) return null
  const digits = normalized.replace(/\D+/g, '')
  return digits || normalized.toLowerCase()
}

function normalizeGenericHash(value) {
  const normalized = normalizeWhitespace(value)
  return normalized ? normalized.toLowerCase() : null
}

function buildHashForField(field, value) {
  if (!value) return null
  switch (field) {
    case 'email':
      return hashValue(value.toLowerCase())
    case 'cell_phone':
    case 'home_phone':
    case 'other_phone':
      return hashValue(normalizePhoneHash(value))
    case 'postal_code':
      return hashValue(normalizePostalCode(value)?.replace(/\s+/g, ''))
    case 'city':
    case 'state_province':
    case 'address_line_1':
      return hashValue(normalizeGenericHash(value))
    default:
      return hashValue(normalizeWhitespace(value))
  }
}

function buildProtectedPatch({ email, address_line_1, city, state_province, postal_code }) {
  const patch = {}
  const normalizedEmail = normalizeField('email', email)
  const normalizedAddress = normalizeField('address_line_1', address_line_1)
  const normalizedCity = normalizeField('city', city)
  const normalizedRegion = normalizeField('state_province', state_province)
  const normalizedPostalCode = normalizeField('postal_code', postal_code)

  for (const [field, normalized] of Object.entries({
    email: normalizedEmail,
    address_line_1: normalizedAddress,
    city: normalizedCity,
    state_province: normalizedRegion,
    postal_code: normalizedPostalCode,
  })) {
    patch[field] = normalized ? encryptString(normalized) : null
    patch[`${field}_hash`] = buildHashForField(field, normalized)
  }

  if (Object.values({ normalizedEmail, normalizedAddress, normalizedCity, normalizedRegion, normalizedPostalCode }).some(Boolean)) {
    patch.pii_key_version = KEY_VERSION
  }

  return patch
}

async function fetchPeopleBatch(from) {
  const columns = [
    'id', 'council_id', 'title', 'first_name', 'middle_name', 'last_name', 'suffix',
    'email', 'email_hash', 'cell_phone', 'cell_phone_hash',
    'address_line_1', 'address_line_1_hash', 'city', 'city_hash',
    'state_province', 'state_province_hash', 'postal_code', 'postal_code_hash',
    'pii_key_version', 'primary_relationship_code',
  ].join(', ')

  const { data, error } = await supabase
    .from('people')
    .select(columns)
    .eq('council_id', councilId)
    .eq('primary_relationship_code', 'member')
    .order('id', { ascending: true })
    .range(from, from + BATCH_SIZE - 1)

  if (error) throw error
  return data ?? []
}

function buildPeoplePatch(row) {
  const decrypted = {
    email: decryptString(row.email),
    address_line_1: decryptString(row.address_line_1),
    city: decryptString(row.city),
    state_province: decryptString(row.state_province),
    postal_code: decryptString(row.postal_code),
  }

  const patch = {}
  const normalizedTitle = normalizeField('title', row.title)
  const normalizedFirstName = normalizeField('first_name', row.first_name)
  const normalizedMiddleName = normalizeField('middle_name', row.middle_name)
  const normalizedLastName = normalizeField('last_name', row.last_name)
  const normalizedSuffix = normalizeField('suffix', row.suffix)

  if ((row.title ?? null) !== normalizedTitle) patch.title = normalizedTitle
  if ((row.first_name ?? null) !== normalizedFirstName) patch.first_name = normalizedFirstName
  if ((row.middle_name ?? null) !== normalizedMiddleName) patch.middle_name = normalizedMiddleName
  if ((row.last_name ?? null) !== normalizedLastName) patch.last_name = normalizedLastName
  if ((row.suffix ?? null) !== normalizedSuffix) patch.suffix = normalizedSuffix

  const protectedPatch = buildProtectedPatch(decrypted)
  const protectedValues = {
    email: normalizeField('email', decrypted.email),
    address_line_1: normalizeField('address_line_1', decrypted.address_line_1),
    city: normalizeField('city', decrypted.city),
    state_province: normalizeField('state_province', decrypted.state_province),
    postal_code: normalizeField('postal_code', decrypted.postal_code),
  }

  for (const key of ['email', 'address_line_1', 'city', 'state_province', 'postal_code']) {
    const currentValue = decrypted[key]
    const nextValue = protectedValues[key]
    const hashKey = `${key}_hash`
    const nextHash = protectedPatch[hashKey]
    if ((currentValue ?? null) !== (nextValue ?? null) || (row[hashKey] ?? null) !== (nextHash ?? null)) {
      patch[key] = protectedPatch[key]
      patch[hashKey] = nextHash
      if (protectedPatch.pii_key_version) {
        patch.pii_key_version = protectedPatch.pii_key_version
      }
    }
  }

  return Object.keys(patch).length > 0 ? patch : null
}

async function fetchKofcProfiles(personIds) {
  if (personIds.length === 0) return []
  const { data, error } = await supabase
    .from('person_kofc_profiles')
    .select('person_id, member_type, member_class')
    .in('person_id', personIds)
  if (error) throw error
  return data ?? []
}

function buildKofcPatch(row) {
  const patch = {}
  const normalizedMemberType = normalizeField('member_type', row.member_type)
  const normalizedMemberClass = normalizeField('member_class', row.member_class)

  if ((row.member_type ?? null) !== normalizedMemberType) patch.member_type = normalizedMemberType
  if ((row.member_class ?? null) !== normalizedMemberClass) patch.member_class = normalizedMemberClass

  return Object.keys(patch).length > 0 ? patch : null
}

const summary = {
  dryRun,
  councilId,
  people: { scanned: 0, updated: 0, samples: [] },
  personKofcProfiles: { scanned: 0, updated: 0, samples: [] },
}

let from = 0
while (true) {
  const people = await fetchPeopleBatch(from)
  if (people.length === 0) break

  for (const row of people) {
    summary.people.scanned += 1
    const patch = buildPeoplePatch(row)
    if (!patch) continue
    if (summary.people.samples.length < 5) {
      summary.people.samples.push({ id: row.id, patch })
    }
    if (!dryRun) {
      const { error } = await supabase.from('people').update(patch).eq('id', row.id)
      if (error) throw new Error(`people:${row.id} -> ${error.message}`)
    }
    summary.people.updated += 1
  }

  const personIds = people.map((row) => row.id)
  const kofcProfiles = await fetchKofcProfiles(personIds)
  for (const row of kofcProfiles) {
    summary.personKofcProfiles.scanned += 1
    const patch = buildKofcPatch(row)
    if (!patch) continue
    if (summary.personKofcProfiles.samples.length < 5) {
      summary.personKofcProfiles.samples.push({ person_id: row.person_id, patch })
    }
    if (!dryRun) {
      const { error } = await supabase.from('person_kofc_profiles').update(patch).eq('person_id', row.person_id)
      if (error) throw new Error(`person_kofc_profiles:${row.person_id} -> ${error.message}`)
    }
    summary.personKofcProfiles.updated += 1
  }

  from += people.length
}

console.log(JSON.stringify(summary, null, 2))
