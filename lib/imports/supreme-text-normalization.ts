const UPPERCASE_WORDS = new Set([
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'NW',
  'NE',
  'SW',
  'SE',
  'PO',
  'RR',
  'RPO',
  'US',
  'UK',
  'QC',
  'ON',
  'BC',
  'AB',
  'MB',
  'SK',
  'NB',
  'NS',
  'NL',
  'PE',
  'NT',
  'NU',
  'YT',
])

const SUFFIX_MAP: Record<string, string> = {
  JR: 'Jr.',
  SR: 'Sr.',
}

function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function titleCaseToken(token: string) {
  if (!token) {
    return token
  }

  const upperToken = token.toUpperCase()
  if (UPPERCASE_WORDS.has(upperToken)) {
    return upperToken
  }

  if (/^\d+[A-Z]{2}$/i.test(token)) {
    const match = token.match(/^(\d+)([A-Z]{2})$/i)
    if (match) {
      return `${match[1]}${match[2].toLowerCase()}`
    }
  }

  const lowerToken = token.toLowerCase()
  let titled = lowerToken.charAt(0).toUpperCase() + lowerToken.slice(1)

  titled = titled.replace(/(^|['’])([a-z])/g, (match, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`)
  titled = titled.replace(/\bMc([a-z])/g, (_match, letter: string) => `Mc${letter.toUpperCase()}`)
  titled = titled.replace(/\bMac([a-z])/g, (_match, letter: string) => `Mac${letter.toUpperCase()}`)
  titled = titled.replace(/^St\.(?=[A-Za-z])/, 'St.')

  return titled
}

function smartTitleCase(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return null
  }

  return normalized
    .split(/(\s+)/)
    .map((segment) => {
      if (/^\s+$/.test(segment)) {
        return segment
      }

      return segment
        .split(/([-\/])/)
        .map((part) => {
          if (part === '-' || part === '/') {
            return part
          }

          return titleCaseToken(part)
        })
        .join('')
    })
    .join('')
}

export function normalizeSupremeImportName(value: string | null | undefined) {
  return smartTitleCase(value)
}

export function normalizeSupremeImportTitle(value: string | null | undefined) {
  const normalized = smartTitleCase(value)
  if (!normalized) {
    return null
  }

  return SUFFIX_MAP[normalized.toUpperCase().replace(/\./g, '')] ?? normalized
}

export function normalizeSupremeImportSuffix(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return null
  }

  const upperValue = normalized.toUpperCase().replace(/\./g, '')
  if (SUFFIX_MAP[upperValue]) {
    return SUFFIX_MAP[upperValue]
  }
  if (UPPERCASE_WORDS.has(upperValue)) {
    return upperValue
  }

  return smartTitleCase(normalized)
}

export function normalizeSupremeImportAddress(value: string | null | undefined) {
  return smartTitleCase(value)
}

export function normalizeSupremeImportCity(value: string | null | undefined) {
  return smartTitleCase(value)
}

export function normalizeSupremeImportStateProvince(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return null
  }

  const collapsed = normalized.replace(/\./g, '')
  if (/^[A-Za-z]{2,3}$/.test(collapsed)) {
    return collapsed.toUpperCase()
  }

  return smartTitleCase(normalized)
}

export function normalizeSupremeImportPostalCode(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return null
  }

  const compact = normalized.replace(/\s+/g, '').toUpperCase()
  if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact)) {
    return `${compact.slice(0, 3)} ${compact.slice(3)}`
  }

  return compact
}

export function normalizeSupremeImportEmail(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value)
  return normalized ? normalized.toLowerCase() : null
}

export function normalizeSupremeImportMemberType(value: string | null | undefined) {
  return smartTitleCase(value)
}

export function normalizeSupremeImportMemberClass(value: string | null | undefined) {
  return smartTitleCase(value)
}

export function normalizeSupremeImportTextField(
  field:
    | 'title'
    | 'first_name'
    | 'middle_name'
    | 'last_name'
    | 'suffix'
    | 'email'
    | 'address_line_1'
    | 'city'
    | 'state_province'
    | 'postal_code'
    | 'supreme_member_type'
    | 'supreme_member_class',
  value: string | null | undefined
) {
  switch (field) {
    case 'title':
      return normalizeSupremeImportTitle(value)
    case 'first_name':
    case 'middle_name':
    case 'last_name':
      return normalizeSupremeImportName(value)
    case 'suffix':
      return normalizeSupremeImportSuffix(value)
    case 'email':
      return normalizeSupremeImportEmail(value)
    case 'address_line_1':
      return normalizeSupremeImportAddress(value)
    case 'city':
      return normalizeSupremeImportCity(value)
    case 'state_province':
      return normalizeSupremeImportStateProvince(value)
    case 'postal_code':
      return normalizeSupremeImportPostalCode(value)
    case 'supreme_member_type':
      return normalizeSupremeImportMemberType(value)
    case 'supreme_member_class':
      return normalizeSupremeImportMemberClass(value)
    default:
      return normalizeWhitespace(value) || null
  }
}
