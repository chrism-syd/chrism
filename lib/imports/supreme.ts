import {
  normalizeSupremeImportTextField,
} from '@/lib/imports/supreme-text-normalization'

export type ImportFieldSectionKey = 'core' | 'membership' | 'kofc'

export type ImportFieldKey =
  | 'member_number'
  | 'title'
  | 'first_name'
  | 'middle_name'
  | 'last_name'
  | 'suffix'
  | 'email'
  | 'cell_phone'
  | 'address_line_1'
  | 'city'
  | 'state_province'
  | 'postal_code'
  | 'birth_date'
  | 'council_activity_level_code'
  | 'supreme_member_type'
  | 'supreme_member_class'
  | 'assembly_number'
  | 'years_of_service'
  | 'first_degree_date'
  | 'second_degree_date'
  | 'third_degree_date'

export type SpreadsheetFieldKey =
  | 'ignore'
  | 'council_number'
  | ImportFieldKey
  | 'home_phone'
  | 'other_phone'

export type ImportFieldDefinition = {
  key: ImportFieldKey
  label: string
  kind: 'text' | 'date' | 'integer' | 'boolean' | 'derived'
  section?: ImportFieldSectionKey
  kofcOnly?: boolean
}

export type ImportFieldSectionDefinition = {
  key: ImportFieldSectionKey
  label: string
  description: string
}

export type SpreadsheetFieldOption = {
  key: SpreadsheetFieldKey
  label: string
  required?: boolean
  helpText?: string
  section?: ImportFieldSectionKey
  kofcOnly?: boolean
}

export type SpreadsheetColumnDefinition = {
  index: number
  label: string
  normalizedHeader: string
  suggestedFieldKey: SpreadsheetFieldKey
}

export type ExistingSupremeComparablePerson = {
  id: string
  primary_relationship_code: string
  council_activity_level_code: string | null
  title: string | null
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  email: string | null
  cell_phone: string | null
  address_line_1: string | null
  city: string | null
  state_province: string | null
  postal_code: string | null
  birth_date: string | null
  member_number: string | null
  supreme_member_type: string | null
  supreme_member_class: string | null
  assembly_number: string | null
  first_degree_date: string | null
  second_degree_date: string | null
  third_degree_date: string | null
  years_of_service: number | null
}

export type SupremeImportRow = {
  rowId: string
  sourceRowNumber: number
  councilNumber: string | null
  memberNumber: string
  title: string | null
  firstName: string
  middleName: string | null
  lastName: string
  suffix: string | null
  email: string | null
  cellPhone: string | null
  homePhone: string | null
  otherPhone: string | null
  streetAddress: string | null
  city: string | null
  stateProvince: string | null
  postalCode: string | null
  firstDegreeDate: string | null
  secondDegreeDate: string | null
  thirdDegreeDate: string | null
  yearsOfService: number | null
  birthDate: string | null
  memberType: string | null
  memberClass: string | null
  assemblyNumber: string | null
}

export type ResolvedImportFieldValues = Record<ImportFieldKey, string | null>

export const IMPORT_FIELD_SECTIONS: ImportFieldSectionDefinition[] = [
  {
    key: 'core',
    label: 'Member details',
    description: 'Name, contact details, and address fields that belong on the shared person record.',
  },
  {
    key: 'membership',
    label: 'Membership details',
    description: 'The membership number and membership status used to match or update the current member record.',
  },
  {
    key: 'kofc',
    label: 'Knights-specific details',
    description: 'Council and Knights profile fields that stay outside the shared people table.',
  },
]

export const IMPORT_FIELD_DEFINITIONS: ImportFieldDefinition[] = [
  { key: 'member_number', label: 'Member number', kind: 'text', section: 'membership', kofcOnly: true },
  { key: 'title', label: 'Prefix / title', kind: 'text', section: 'core' },
  { key: 'first_name', label: 'First name', kind: 'text', section: 'core' },
  { key: 'middle_name', label: 'Middle name', kind: 'text', section: 'core' },
  { key: 'last_name', label: 'Last name', kind: 'text', section: 'core' },
  { key: 'suffix', label: 'Suffix', kind: 'text', section: 'core' },
  { key: 'email', label: 'Email', kind: 'text', section: 'core' },
  { key: 'cell_phone', label: 'Cell phone', kind: 'text', section: 'core' },
  { key: 'address_line_1', label: 'Street address', kind: 'text', section: 'core' },
  { key: 'city', label: 'City', kind: 'text', section: 'core' },
  { key: 'state_province', label: 'Province / state', kind: 'text', section: 'core' },
  { key: 'postal_code', label: 'Postal code', kind: 'text', section: 'core' },
  { key: 'birth_date', label: 'Birth date', kind: 'date', section: 'core' },
  {
    key: 'council_activity_level_code',
    label: 'Membership status',
    kind: 'derived',
    section: 'membership',
  },
  { key: 'supreme_member_type', label: 'Member type', kind: 'text', section: 'kofc', kofcOnly: true },
  { key: 'supreme_member_class', label: 'Member class', kind: 'text', section: 'kofc', kofcOnly: true },
  { key: 'assembly_number', label: 'Assembly number', kind: 'text', section: 'kofc', kofcOnly: true },
  { key: 'years_of_service', label: 'Years in service', kind: 'integer', section: 'kofc', kofcOnly: true },
  { key: 'first_degree_date', label: 'First degree date', kind: 'date', section: 'kofc', kofcOnly: true },
  { key: 'second_degree_date', label: 'Second degree date', kind: 'date', section: 'kofc', kofcOnly: true },
  { key: 'third_degree_date', label: 'Third degree date', kind: 'date', section: 'kofc', kofcOnly: true },
]

export const SPREADSHEET_FIELD_OPTIONS: SpreadsheetFieldOption[] = [
  { key: 'ignore', label: 'Not mapped' },
  { key: 'council_number', label: 'Council number', required: true, section: 'kofc', kofcOnly: true },
  { key: 'member_number', label: 'Member number', required: true, section: 'membership', kofcOnly: true },
  { key: 'title', label: 'Prefix / title', section: 'core' },
  { key: 'first_name', label: 'First name', required: true, section: 'core' },
  { key: 'middle_name', label: 'Middle name', section: 'core' },
  { key: 'last_name', label: 'Last name', required: true, section: 'core' },
  { key: 'suffix', label: 'Suffix', section: 'core' },
  { key: 'email', label: 'Email', helpText: 'Saved on the shared member profile.', section: 'core' },
  { key: 'cell_phone', label: 'Cell phone', helpText: 'Saved on the shared member profile.', section: 'core' },
  {
    key: 'home_phone',
    label: 'Home phone',
    helpText: 'Detected from the file, but this importer does not save it yet.',
    section: 'core',
  },
  {
    key: 'other_phone',
    label: 'Other phone',
    helpText: 'Detected from the file, but this importer does not save it yet.',
    section: 'core',
  },
  { key: 'address_line_1', label: 'Street address', section: 'core' },
  { key: 'city', label: 'City', section: 'core' },
  { key: 'state_province', label: 'Province / state', section: 'core' },
  { key: 'postal_code', label: 'Postal code', section: 'core' },
  { key: 'birth_date', label: 'Birth date', section: 'core' },
  { key: 'supreme_member_type', label: 'Member type', section: 'kofc', kofcOnly: true },
  { key: 'supreme_member_class', label: 'Member class', section: 'kofc', kofcOnly: true },
  { key: 'assembly_number', label: 'Assembly number', section: 'kofc', kofcOnly: true },
  { key: 'years_of_service', label: 'Years in service', section: 'kofc', kofcOnly: true },
  { key: 'first_degree_date', label: 'First degree date', section: 'kofc', kofcOnly: true },
  { key: 'second_degree_date', label: 'Second degree date', section: 'kofc', kofcOnly: true },
  { key: 'third_degree_date', label: 'Third degree date', section: 'kofc', kofcOnly: true },
]

const REQUIRED_SPREADSHEET_FIELDS: SpreadsheetFieldKey[] = [
  'council_number',
  'member_number',
  'first_name',
  'last_name',
]

const HEADER_ALIASES: Partial<Record<string, SpreadsheetFieldKey>> = {
  council_number: 'council_number',
  council_no: 'council_number',
  council: 'council_number',
  member_number: 'member_number',
  membership_number: 'member_number',
  member_no: 'member_number',
  member_num: 'member_number',
  title: 'title',
  first_name: 'first_name',
  firstname: 'first_name',
  given_name: 'first_name',
  middle_name: 'middle_name',
  middle_initial: 'middle_name',
  last_name: 'last_name',
  lastname: 'last_name',
  surname: 'last_name',
  family_name: 'last_name',
  suffix: 'suffix',
  street_address: 'address_line_1',
  address: 'address_line_1',
  address_1: 'address_line_1',
  address_line_1: 'address_line_1',
  city: 'city',
  state: 'state_province',
  province: 'state_province',
  state_province: 'state_province',
  postal_code: 'postal_code',
  zip: 'postal_code',
  zip_code: 'postal_code',
  birth_date: 'birth_date',
  dob: 'birth_date',
  member_type: 'supreme_member_type',
  membership_type: 'supreme_member_type',
  member_class: 'supreme_member_class',
  class: 'supreme_member_class',
  assy: 'assembly_number',
  assembly: 'assembly_number',
  assembly_number: 'assembly_number',
  yrs_svc: 'years_of_service',
  yrs_in_service: 'years_of_service',
  years_of_service: 'years_of_service',
  years_service: 'years_of_service',
  first_degree: 'first_degree_date',
  first_degree_date: 'first_degree_date',
  second_degree: 'second_degree_date',
  second_degree_date: 'second_degree_date',
  third_degree: 'third_degree_date',
  third_degree_date: 'third_degree_date',
  email: 'email',
  email_address: 'email',
  personal_email: 'email',
  cell_phone: 'cell_phone',
  mobile_phone: 'cell_phone',
  mobile: 'cell_phone',
  phone: 'cell_phone',
  phone_number: 'cell_phone',
  home_phone: 'home_phone',
  other_phone: 'other_phone',
}

function inferFieldKeyFromHeader(normalizedHeader: string): SpreadsheetFieldKey {
  const aliased = HEADER_ALIASES[normalizedHeader]
  if (aliased) {
    return aliased
  }

  if (normalizedHeader.includes('email')) {
    return 'email'
  }

  if (normalizedHeader.includes('cell') || normalizedHeader.includes('mobile')) {
    return 'cell_phone'
  }

  if (normalizedHeader.includes('home') && normalizedHeader.includes('phone')) {
    return 'home_phone'
  }

  if (normalizedHeader.includes('phone')) {
    return 'cell_phone'
  }

  return 'ignore'
}

export function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

export function normalizeLookupValue(value: string | null | undefined) {
  return normalizeWhitespace(value).toLowerCase()
}

export function normalizeMemberNumber(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value)
  return normalized === '' ? null : normalized
}

export function parseSpreadsheetDate(value: unknown): string | null {
  if (value == null || value === '') {
    return null
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const parsed = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }
  }

  const text = normalizeWhitespace(String(value))
  if (!text) {
    return null
  }

  const mmddyyyy = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    const [, year, month, day] = iso
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  return null
}

export function parseSpreadsheetInteger(value: unknown) {
  if (value == null || value === '') {
    return null
  }

  const parsed = Number(String(value).replace(/[^0-9.-]+/g, ''))
  return Number.isInteger(parsed) ? parsed : null
}

export function normalizeHeader(value: string) {
  return normalizeLookupValue(value).replace(/[^a-z0-9]+/g, '_')
}

export function extractSpreadsheetColumns(rows: unknown[][]) {
  const headerIndex = rows.findIndex((row) => {
    const normalized = row.map((cell) => normalizeHeader(String(cell ?? '')))
    return normalized.includes('member_number') && normalized.includes('council_number')
  })

  if (headerIndex < 0) {
    return null
  }

  const columns = rows[headerIndex].map((cell, index) => {
    const label = normalizeWhitespace(String(cell ?? ''))
    const normalizedHeader = normalizeHeader(label)
    return {
      index,
      label: label || `Column ${index + 1}`,
      normalizedHeader,
      suggestedFieldKey: inferFieldKeyFromHeader(normalizedHeader),
    } satisfies SpreadsheetColumnDefinition
  })

  return { headerIndex, columns }
}

export function createInitialColumnMapping(columns: SpreadsheetColumnDefinition[]) {
  const mapping: Record<number, SpreadsheetFieldKey> = {}
  const used = new Set<SpreadsheetFieldKey>()

  for (const column of columns) {
    const suggestion = column.suggestedFieldKey
    if (suggestion === 'ignore') {
      mapping[column.index] = 'ignore'
      continue
    }

    if (used.has(suggestion)) {
      mapping[column.index] = 'ignore'
      continue
    }

    mapping[column.index] = suggestion
    used.add(suggestion)
  }

  return mapping
}

export function getMissingRequiredMappings(mapping: Record<number, SpreadsheetFieldKey>) {
  const mappedFields = new Set(Object.values(mapping))
  return REQUIRED_SPREADSHEET_FIELDS.filter((field) => !mappedFields.has(field))
}

function readMappedCell(
  row: unknown[],
  mappingEntries: ReadonlyArray<readonly [number, SpreadsheetFieldKey]>,
  targetField: SpreadsheetFieldKey
) {
  const match = mappingEntries.find(([, field]) => field === targetField)
  if (!match) {
    return undefined
  }

  return row[match[0]]
}

export function mapSpreadsheetRowsToSupremeRows(
  rows: unknown[][],
  columnMapping: Record<number, SpreadsheetFieldKey>
) {
  const headerInfo = extractSpreadsheetColumns(rows)
  if (!headerInfo) {
    return [] as SupremeImportRow[]
  }

  const dataRows = rows.slice(headerInfo.headerIndex + 1)
  const mappingEntries = Object.entries(columnMapping).map(([index, field]) => [Number(index), field] as const)

  return dataRows
    .map((row, rowOffset) => {
      const get = (field: SpreadsheetFieldKey) => readMappedCell(row, mappingEntries, field)
      const firstName = normalizeWhitespace(String(get('first_name') ?? ''))
      const lastName = normalizeWhitespace(String(get('last_name') ?? ''))
      const memberNumber = normalizeMemberNumber(String(get('member_number') ?? ''))

      if (!firstName || !lastName || !memberNumber) {
        return null
      }

      return {
        rowId: `${memberNumber}-${rowOffset + headerInfo.headerIndex + 2}`,
        sourceRowNumber: rowOffset + headerInfo.headerIndex + 2,
        councilNumber: normalizeMemberNumber(String(get('council_number') ?? '')),
        memberNumber,
        title: normalizeSupremeImportTextField('title', String(get('title') ?? '')),
        firstName: normalizeSupremeImportTextField('first_name', firstName) ?? firstName,
        middleName: normalizeSupremeImportTextField('middle_name', String(get('middle_name') ?? '')),
        lastName: normalizeSupremeImportTextField('last_name', lastName) ?? lastName,
        suffix: normalizeSupremeImportTextField('suffix', String(get('suffix') ?? '')),
        email: normalizeSupremeImportTextField('email', String(get('email') ?? '')),
        cellPhone: normalizeWhitespace(String(get('cell_phone') ?? '')) || null,
        homePhone: normalizeWhitespace(String(get('home_phone') ?? '')) || null,
        otherPhone: normalizeWhitespace(String(get('other_phone') ?? '')) || null,
        streetAddress: normalizeSupremeImportTextField('address_line_1', String(get('address_line_1') ?? '')),
        city: normalizeSupremeImportTextField('city', String(get('city') ?? '')),
        stateProvince: normalizeSupremeImportTextField('state_province', String(get('state_province') ?? '')),
        postalCode: normalizeSupremeImportTextField('postal_code', String(get('postal_code') ?? '')),
        firstDegreeDate: parseSpreadsheetDate(get('first_degree_date')),
        secondDegreeDate: parseSpreadsheetDate(get('second_degree_date')),
        thirdDegreeDate: parseSpreadsheetDate(get('third_degree_date')),
        yearsOfService: parseSpreadsheetInteger(get('years_of_service')),
        birthDate: parseSpreadsheetDate(get('birth_date')),
        memberType: normalizeSupremeImportTextField('supreme_member_type', String(get('supreme_member_type') ?? '')),
        memberClass: normalizeSupremeImportTextField('supreme_member_class', String(get('supreme_member_class') ?? '')),
        assemblyNumber: normalizeMemberNumber(String(get('assembly_number') ?? '')),
      } satisfies SupremeImportRow
    })
    .filter(Boolean) as SupremeImportRow[]
}

export function deriveCouncilActivityLevelCode(memberType: string | null | undefined) {
  return normalizeLookupValue(memberType) === 'inactive' ? 'inactive' : 'active'
}

export function importedFieldValues(row: SupremeImportRow): ResolvedImportFieldValues {
  return {
    member_number: row.memberNumber,
    title: row.title,
    first_name: row.firstName,
    middle_name: row.middleName,
    last_name: row.lastName,
    suffix: row.suffix,
    email: row.email,
    cell_phone: row.cellPhone,
    address_line_1: row.streetAddress,
    city: row.city,
    state_province: row.stateProvince,
    postal_code: row.postalCode,
    birth_date: row.birthDate,
    council_activity_level_code: deriveCouncilActivityLevelCode(row.memberType),
    supreme_member_type: row.memberType,
    supreme_member_class: row.memberClass,
    assembly_number: row.assemblyNumber,
    years_of_service: row.yearsOfService == null ? null : String(row.yearsOfService),
    first_degree_date: row.firstDegreeDate,
    second_degree_date: row.secondDegreeDate,
    third_degree_date: row.thirdDegreeDate,
  }
}

export function existingFieldValues(person: ExistingSupremeComparablePerson | null): ResolvedImportFieldValues {
  return {
    member_number: person?.member_number ?? null,
    title: person?.title ?? null,
    first_name: person?.first_name ?? null,
    middle_name: person?.middle_name ?? null,
    last_name: person?.last_name ?? null,
    suffix: person?.suffix ?? null,
    email: person?.email ?? null,
    cell_phone: person?.cell_phone ?? null,
    address_line_1: person?.address_line_1 ?? null,
    city: person?.city ?? null,
    state_province: person?.state_province ?? null,
    postal_code: person?.postal_code ?? null,
    birth_date: person?.birth_date ?? null,
    council_activity_level_code: person?.council_activity_level_code ?? null,
    supreme_member_type: person?.supreme_member_type ?? null,
    supreme_member_class: person?.supreme_member_class ?? null,
    assembly_number: person?.assembly_number ?? null,
    years_of_service: person?.years_of_service == null ? null : String(person.years_of_service),
    first_degree_date: person?.first_degree_date ?? null,
    second_degree_date: person?.second_degree_date ?? null,
    third_degree_date: person?.third_degree_date ?? null,
  }
}

export function normalizeComparableValue(field: ImportFieldDefinition, value: string | null) {
  if (value == null) {
    return ''
  }

  if (field.kind === 'integer') {
    const parsed = parseSpreadsheetInteger(value)
    return parsed == null ? '' : String(parsed)
  }

  if (field.kind === 'date') {
    return parseSpreadsheetDate(value) ?? ''
  }

  return normalizeLookupValue(value)
}

export function formatDisplayValue(field: ImportFieldDefinition, value: string | null) {
  if (value == null || value === '') {
    return '—'
  }

  if (field.kind === 'derived' && field.key === 'council_activity_level_code') {
    return value.charAt(0).toUpperCase() + value.slice(1)
  }

  return value
}

export function buildExistingMemberMatchIndexes(existingMembers: ExistingSupremeComparablePerson[]) {
  const byMemberNumber = new Map<string, ExistingSupremeComparablePerson[]>()
  const byNameBirthDate = new Map<string, ExistingSupremeComparablePerson[]>()
  const byNameOnly = new Map<string, ExistingSupremeComparablePerson[]>()

  for (const member of existingMembers) {
    const normalizedMemberNumber = normalizeMemberNumber(member.member_number)
    if (normalizedMemberNumber) {
      const existing = byMemberNumber.get(normalizedMemberNumber) ?? []
      byMemberNumber.set(normalizedMemberNumber, [...existing, member])
    }

    const nameOnlyKey = [member.first_name, member.middle_name, member.last_name]
      .map((part) => normalizeLookupValue(part))
      .join('|')

    const existingNameOnly = byNameOnly.get(nameOnlyKey) ?? []
    byNameOnly.set(nameOnlyKey, [...existingNameOnly, member])

    if (member.birth_date) {
      const birthKey = `${nameOnlyKey}|${member.birth_date}`
      const existingBirth = byNameBirthDate.get(birthKey) ?? []
      byNameBirthDate.set(birthKey, [...existingBirth, member])
    }
  }

  return { byMemberNumber, byNameBirthDate, byNameOnly }
}

export function matchImportedRowToExisting(
  row: SupremeImportRow,
  indexes: ReturnType<typeof buildExistingMemberMatchIndexes>
) {
  const normalizedMemberNumber = normalizeMemberNumber(row.memberNumber)
  const memberNumberMatches = normalizedMemberNumber
    ? indexes.byMemberNumber.get(normalizedMemberNumber) ?? []
    : []

  if (memberNumberMatches.length === 1) {
    return {
      person: memberNumberMatches[0] ?? null,
      matchReason: 'member_number' as const,
      hasConflict: false,
    }
  }

  if (memberNumberMatches.length > 1) {
    return {
      person: null,
      matchReason: 'member_number' as const,
      hasConflict: true,
    }
  }

  const nameOnlyKey = [row.firstName, row.middleName, row.lastName]
    .map((part) => normalizeLookupValue(part))
    .join('|')

  if (row.birthDate) {
    const byNameBirthDate = indexes.byNameBirthDate.get(`${nameOnlyKey}|${row.birthDate}`) ?? []
    if (byNameBirthDate.length === 1) {
      return {
        person: byNameBirthDate[0] ?? null,
        matchReason: 'name_birth_date' as const,
        hasConflict: false,
      }
    }

    if (byNameBirthDate.length > 1) {
      return {
        person: null,
        matchReason: 'name_birth_date' as const,
        hasConflict: true,
      }
    }
  }

  const byNameOnly = indexes.byNameOnly.get(nameOnlyKey) ?? []
  if (byNameOnly.length === 1) {
    return {
      person: byNameOnly[0] ?? null,
      matchReason: 'name_only' as const,
      hasConflict: false,
    }
  }

  return {
    person: null,
    matchReason: 'new_member' as const,
    hasConflict: memberNumberMatches.length > 1 || byNameOnly.length > 1,
  }
}
