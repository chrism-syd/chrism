import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ENCRYPTED_PREFIX = 'enc'
const DEFAULT_KEY_VERSION = process.env.PII_KEY_VERSION?.trim() || 'v1'
const PII_KEY_ENV = process.env.PII_ENCRYPTION_KEY?.trim() || ''

export const PEOPLE_PROTECTED_FIELDS = [
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
] as const

export const PEOPLE_HASH_ONLY_FIELDS = ['birth_date'] as const

export const PROFILE_CHANGE_REQUEST_PROTECTED_FIELDS = [
  'proposed_email',
  'proposed_cell_phone',
  'proposed_home_phone',
] as const

type ProtectedPeopleField = (typeof PEOPLE_PROTECTED_FIELDS)[number]
type HashOnlyPeopleField = (typeof PEOPLE_HASH_ONLY_FIELDS)[number]
type ProtectedProfileChangeField = (typeof PROFILE_CHANGE_REQUEST_PROTECTED_FIELDS)[number]
type HashableField = ProtectedPeopleField | HashOnlyPeopleField | ProtectedProfileChangeField
type AnyRecord = Record<string, unknown>

function getPiiKeyMaterial() {
  if (!PII_KEY_ENV) {
    throw new Error('Missing PII_ENCRYPTION_KEY. Configure it before reading or writing encrypted member data.')
  }

  return createHash('sha256').update(PII_KEY_ENV).digest()
}

function hashNormalizedValue(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function isEncryptedValue(value: string) {
  return value.startsWith(`${ENCRYPTED_PREFIX}:`)
}

function encryptString(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getPiiKeyMaterial(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    ENCRYPTED_PREFIX,
    DEFAULT_KEY_VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':')
}

function decryptString(value: string) {
  if (!isEncryptedValue(value)) {
    return value
  }

  const [prefix, version, iv, authTag, encrypted] = value.split(':')
  if (prefix !== ENCRYPTED_PREFIX || !version || !iv || !authTag || !encrypted) {
    throw new Error('Invalid encrypted PII value format.')
  }

  const decipher = createDecipheriv('aes-256-gcm', getPiiKeyMaterial(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(authTag, 'base64url'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function normalizeEmailForStorage(value: string | null | undefined) {
  const normalized = normalizeText(value)
  return normalized ? normalized.toLowerCase() : null
}

export function normalizePhoneForStorage(value: string | null | undefined) {
  return normalizeText(value)
}

export function normalizePhoneForHash(value: string | null | undefined) {
  const normalized = normalizePhoneForStorage(value)
  if (!normalized) {
    return null
  }

  const digitsOnly = normalized.replace(/\D+/g, '')
  return digitsOnly || normalized.toLowerCase()
}

export function normalizePostalCodeForHash(value: string | null | undefined) {
  const normalized = normalizeText(value)
  return normalized ? normalized.replace(/\s+/g, '').toUpperCase() : null
}

export function normalizeDateForHash(value: string | null | undefined) {
  return normalizeText(value)
}

export function normalizeGenericForHash(value: string | null | undefined) {
  const normalized = normalizeText(value)
  return normalized ? normalized.toLowerCase() : null
}

function normalizedHashInput(field: HashableField, value: string | null) {
  if (!value) {
    return null
  }

  switch (field) {
    case 'email':
    case 'proposed_email':
      return normalizeEmailForStorage(value)
    case 'cell_phone':
    case 'home_phone':
    case 'other_phone':
    case 'proposed_cell_phone':
    case 'proposed_home_phone':
      return normalizePhoneForHash(value)
    case 'postal_code':
      return normalizePostalCodeForHash(value)
    case 'birth_date':
      return normalizeDateForHash(value)
    default:
      return normalizeGenericForHash(value)
  }
}

export function buildHashForField(field: HashableField, value: string | null | undefined) {
  const normalized = normalizedHashInput(field, normalizeText(value))
  return normalized ? hashNormalizedValue(normalized) : null
}

function normalizeStoredFieldValue(field: ProtectedPeopleField | ProtectedProfileChangeField, value: string | null) {
  if (!value) {
    return null
  }

  switch (field) {
    case 'email':
    case 'proposed_email':
      return normalizeEmailForStorage(value)
    case 'cell_phone':
    case 'home_phone':
    case 'other_phone':
    case 'proposed_cell_phone':
    case 'proposed_home_phone':
      return normalizePhoneForStorage(value)
    default:
      return value
  }
}

function hashColumnName(field: HashableField) {
  return `${field}_hash`
}

export function decryptOptionalValue(value: string | null | undefined) {
  if (!value) {
    return null
  }

  return decryptString(value)
}

export function protectPeoplePayload<T extends AnyRecord>(payload: T): T & Record<string, string | null> {
  const nextPayload: AnyRecord = { ...payload }
  let shouldSetKeyVersion = false

  for (const field of PEOPLE_PROTECTED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) {
      continue
    }

    const normalized = normalizeStoredFieldValue(field, normalizeText(payload[field]))
    nextPayload[field] = normalized ? encryptString(normalized) : null
    nextPayload[hashColumnName(field)] = buildHashForField(field, normalized)
    shouldSetKeyVersion = shouldSetKeyVersion || Boolean(normalized)
  }

  for (const field of PEOPLE_HASH_ONLY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) {
      continue
    }

    const normalized = normalizeText(payload[field])
    nextPayload[field] = normalized
    nextPayload[hashColumnName(field)] = buildHashForField(field, normalized)
  }

  if (shouldSetKeyVersion) {
    nextPayload.pii_key_version = DEFAULT_KEY_VERSION
  }

  return nextPayload as T & Record<string, string | null>
}

export function decryptPeopleRecord<T extends AnyRecord>(row: T): T {
  const nextRow: AnyRecord = { ...row }

  for (const field of PEOPLE_PROTECTED_FIELDS) {
    const rawValue = row[field]
    nextRow[field] = typeof rawValue === 'string' ? decryptString(rawValue) : rawValue ?? null
  }

  for (const field of PEOPLE_HASH_ONLY_FIELDS) {
    nextRow[field] = row[field] ?? null
  }

  return nextRow as T
}

export function decryptPeopleRecords<T extends AnyRecord>(rows: T[] | null | undefined) {
  return (rows ?? []).map((row) => decryptPeopleRecord(row))
}

export function protectProfileChangeRequestPayload<T extends AnyRecord>(payload: T): T & Record<string, string | null> {
  const nextPayload: AnyRecord = { ...payload }
  let shouldSetKeyVersion = false

  for (const field of PROFILE_CHANGE_REQUEST_PROTECTED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, field)) {
      continue
    }

    const normalized = normalizeStoredFieldValue(field, normalizeText(payload[field]))
    nextPayload[field] = normalized ? encryptString(normalized) : null
    nextPayload[hashColumnName(field)] = buildHashForField(field, normalized)
    shouldSetKeyVersion = shouldSetKeyVersion || Boolean(normalized)
  }

  if (shouldSetKeyVersion) {
    nextPayload.pii_key_version = DEFAULT_KEY_VERSION
  }

  return nextPayload as T & Record<string, string | null>
}

export function decryptProfileChangeRequestRecord<T extends AnyRecord>(row: T): T {
  const nextRow: AnyRecord = { ...row }

  for (const field of PROFILE_CHANGE_REQUEST_PROTECTED_FIELDS) {
    const rawValue = row[field]
    nextRow[field] = typeof rawValue === 'string' ? decryptString(rawValue) : rawValue ?? null
  }

  return nextRow as T
}

export function decryptProfileChangeRequestRecords<T extends AnyRecord>(rows: T[] | null | undefined) {
  return (rows ?? []).map((row) => decryptProfileChangeRequestRecord(row))
}
