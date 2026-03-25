export type OfficerScopeCode = 'council' | 'district' | 'state' | string

export type OfficerRoleOption = {
  officeScopeCode: OfficerScopeCode
  officeCode: string
  officeLabel: string
  office_scope_code: OfficerScopeCode
  office_code: string
  office_label: string
  rankOptions?: number[]
  rank_options?: number[]
  allowsRank: boolean
  allows_rank: boolean
  scope: OfficerScopeCode
  code: string
  label: string
  supportsRank: boolean
}

export type OfficerRoleGroup = {
  label: string
  scope: OfficerScopeCode
  options: OfficerRoleOption[]
}

export type OfficerTermRow = {
  id: string
  person_id?: string
  office_scope_code: OfficerScopeCode
  office_code: string
  office_label: string
  office_rank: number | null
  service_start_year: number
  service_end_year: number | null
  notes: string | null
}

type OfficerLabelInput =
  | Pick<OfficerTermRow, 'office_label' | 'office_rank'>
  | {
      office_scope_code?: OfficerScopeCode | null
      office_code?: string | null
      office_rank?: number | null
      office_label?: string | null
    }
  | {
      scope?: OfficerScopeCode | null
      code?: string | null
      rank?: number | null
      office_label?: string | null
      office_rank?: number | null
    }

type HonorificInput =
  | string
  | null
  | undefined
  | {
      scope?: OfficerScopeCode | null
      code?: string | null
      endYear?: number | null
    }

const LASTING_HONORIFICS: Record<string, string> = {
  grand_knight: 'Past Grand Knight',
  district_deputy: 'Past District Deputy',
}

const HONORIFIC_SUFFIXES: Record<string, string> = {
  grand_knight: 'PGK',
  district_deputy: 'PDD',
}
const HONORIFIC_LABELS: Record<string, string> = {
  past_grand_knight: 'Past Grand Knight',
  past_district_deputy: 'Past District Deputy',
}

const EXECUTIVE_COMMITTEE_OFFICE_CODES = new Set<string>([
  'grand_knight',
  'deputy_grand_knight',
  'chancellor',
  'recorder',
  'treasurer',
  'advocate',
  'warden',
  'inside_guard',
  'outside_guard',
  'trustee',
])

const AUTOMATIC_COUNCIL_ADMIN_OFFICE_CODES = new Set<string>([
  'grand_knight',
  'financial_secretary',
])

function buildRole(
  scope: OfficerScopeCode,
  code: string,
  label: string,
  rankOptions?: number[]
): OfficerRoleOption {
  const allowsRank = Boolean(rankOptions?.length)

  return {
    officeScopeCode: scope,
    officeCode: code,
    officeLabel: label,
    office_scope_code: scope,
    office_code: code,
    office_label: label,
    rankOptions,
    rank_options: rankOptions,
    allowsRank,
    allows_rank: allowsRank,
    scope,
    code,
    label,
    supportsRank: allowsRank,
  }
}

export const OFFICER_ROLE_OPTIONS: OfficerRoleOption[] = [
  buildRole('council', 'grand_knight', 'Grand Knight'),
  buildRole('council', 'deputy_grand_knight', 'Deputy Grand Knight'),
  buildRole('council', 'chancellor', 'Chancellor'),
  buildRole('council', 'warden', 'Warden'),
  buildRole('council', 'advocate', 'Advocate'),
  buildRole('council', 'recorder', 'Recorder'),
  buildRole('council', 'treasurer', 'Treasurer'),
  buildRole('council', 'inside_guard', 'Inside Guard'),
  buildRole('council', 'outside_guard', 'Outside Guard'),
  buildRole('council', 'lecturer', 'Lecturer'),
  buildRole('council', 'financial_secretary', 'Financial Secretary'),
  buildRole('council', 'district_deputy', 'District Deputy'),
  buildRole('council', 'chaplain', 'Chaplain'),
  buildRole('council', 'trustee', 'Trustee', [1, 2, 3]),
  buildRole('district', 'district_deputy', 'District Deputy'),
  buildRole('state', 'state_deputy', 'State Deputy'),
  buildRole('state', 'state_secretary', 'State Secretary'),
  buildRole('state', 'state_treasurer', 'State Treasurer'),
  buildRole('state', 'state_advocate', 'State Advocate'),
  buildRole('state', 'state_warden', 'State Warden'),
  buildRole('state', 'immediate_past_state_deputy', 'Immediate Past State Deputy'),
  buildRole('state', 'state_chaplain', 'State Chaplain'),
  buildRole('state', 'state_program_director', 'State Program Director'),
  buildRole('state', 'state_membership_director', 'State Membership Director'),
  buildRole('state', 'state_faith_in_action_director', 'State Faith in Action Director'),
]

export const OFFICER_ROLE_GROUPS: OfficerRoleGroup[] = [
  {
    label: 'Council offices',
    scope: 'council',
    options: OFFICER_ROLE_OPTIONS.filter((option) => option.officeScopeCode === 'council'),
  },
  {
    label: 'District offices',
    scope: 'district',
    options: OFFICER_ROLE_OPTIONS.filter((option) => option.officeScopeCode === 'district'),
  },
  {
    label: 'State offices',
    scope: 'state',
    options: OFFICER_ROLE_OPTIONS.filter((option) => option.officeScopeCode === 'state'),
  },
]

export function getOfficerRoleOption(
  officeScopeCode: OfficerScopeCode,
  officeCode: string
): OfficerRoleOption | undefined {
  return OFFICER_ROLE_OPTIONS.find(
    (option) => option.officeScopeCode === officeScopeCode && option.officeCode === officeCode
  )
}

function getCurrentYear() {
  return new Date().getFullYear()
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function getOfficerDisplayLabel(args: { scope?: OfficerScopeCode | null; code?: string | null; rank?: number | null }) {
  const option = args.scope && args.code ? getOfficerRoleOption(args.scope, args.code) : undefined
  const baseLabel = option?.officeLabel ?? option?.label ?? formatHonorificLabel(args.code)

  if (!baseLabel) {
    return ''
  }

  if (!args.rank) {
    return baseLabel
  }

  const lowered = baseLabel.toLowerCase()

  if (lowered === 'trustee') {
    const suffix =
      args.rank === 1
        ? '3-Year'
        : args.rank === 2
          ? '2-Year'
          : args.rank === 3
            ? '1-Year'
            : `Year ${args.rank}`

    return `Trustee (${suffix})`
  }

  return `${baseLabel} ${args.rank}`
}

export function formatHonorificLabel(value: HonorificInput) {
  if (typeof value === 'object' && value !== null) {
    if (value.endYear == null) {
      return ''
    }

    const mapped = value.code ? LASTING_HONORIFICS[value.code] : undefined
    return mapped ?? ''
  }

  const normalized = (value ?? '').trim()
  if (!normalized) {
    return ''
  }

  const mapped = HONORIFIC_LABELS[normalized]
  if (mapped) {
    return mapped
  }

  if (normalized.includes('_') || normalized.includes('-')) {
    return toTitleCase(normalized.replace(/[_-]+/g, ' '))
  }

  return normalized
}

export function isCurrentOfficerTerm(term: OfficerTermRow, referenceYear = getCurrentYear()) {
  return term.service_start_year <= referenceYear && (term.service_end_year == null || term.service_end_year >= referenceYear)
}

export const isOfficerTermCurrent = isCurrentOfficerTerm

export function isExecutiveCommitteeOffice(
  officeScopeCode: OfficerScopeCode,
  officeCode: string
) {
  return officeScopeCode === 'council' && EXECUTIVE_COMMITTEE_OFFICE_CODES.has(officeCode)
}

export function isExecutiveCommitteeTerm(term: Pick<OfficerTermRow, 'office_scope_code' | 'office_code'>) {
  return isExecutiveCommitteeOffice(term.office_scope_code, term.office_code)
}

export function isAutomaticCouncilAdminOffice(
  officeScopeCode: OfficerScopeCode,
  officeCode: string
) {
  return officeScopeCode === 'council' && AUTOMATIC_COUNCIL_ADMIN_OFFICE_CODES.has(officeCode)
}

export function isAutomaticCouncilAdminTerm(
  term: Pick<OfficerTermRow, 'office_scope_code' | 'office_code'>
) {
  return isAutomaticCouncilAdminOffice(term.office_scope_code, term.office_code)
}

export function formatOfficerLabel(term: OfficerLabelInput) {
  const explicitLabel = typeof term.office_label === 'string' ? term.office_label : null
  const explicitRank = 'office_rank' in term ? term.office_rank ?? null : 'rank' in term ? term.rank ?? null : null

  if (explicitLabel) {
    if (!explicitRank) {
      return explicitLabel
    }

    const lowered = explicitLabel.toLowerCase()

    if (lowered === 'trustee') {
      const suffix =
        explicitRank === 1
          ? '3-Year'
          : explicitRank === 2
            ? '2-Year'
            : explicitRank === 3
              ? '1-Year'
              : `Year ${explicitRank}`

      return `Trustee (${suffix})`
    }

    return `${explicitLabel} ${explicitRank}`
  }

  const scope = 'office_scope_code' in term ? term.office_scope_code : 'scope' in term ? term.scope : null
  const code = 'office_code' in term ? term.office_code : 'code' in term ? term.code : null
  return getOfficerDisplayLabel({ scope, code, rank: explicitRank })
}

export function buildOfficerDisplayLabel(term: Pick<
  OfficerTermRow,
  'office_scope_code' | 'office_code' | 'office_rank' | 'office_label'
>) {
  return formatOfficerLabel(term)
}

export function summarizeCurrentOfficerLabels(
  terms: OfficerTermRow[],
  referenceYear = getCurrentYear()
) {
  return terms
    .filter((term) => isCurrentOfficerTerm(term, referenceYear))
    .sort((a, b) => {
      const aLabel = formatOfficerLabel(a)
      const bLabel = formatOfficerLabel(b)
      return aLabel.localeCompare(bLabel)
    })
    .map((term) => formatOfficerLabel(term))
}

export function summarizeExecutiveOfficerLabels(
  terms: OfficerTermRow[],
  referenceYear = getCurrentYear()
) {
  return terms
    .filter((term) => isCurrentOfficerTerm(term, referenceYear) && isExecutiveCommitteeTerm(term))
    .sort((a, b) => {
      const aLabel = formatOfficerLabel(a)
      const bLabel = formatOfficerLabel(b)
      return aLabel.localeCompare(bLabel)
    })
    .map((term) => formatOfficerLabel(term))
}

export function summarizeLastingHonorifics(terms: OfficerTermRow[]) {
  const honorifics = new Set<string>()

  for (const term of terms) {
    if (term.service_end_year == null) {
      continue
    }

    const honorific = LASTING_HONORIFICS[term.office_code]
    if (honorific) {
      honorifics.add(honorific)
    }
  }

  return [...honorifics].sort((a, b) => a.localeCompare(b))
}

export function summarizeHonorificSuffixes(terms: OfficerTermRow[]) {
  const suffixes = new Set<string>()

  for (const term of terms) {
    if (term.service_end_year == null) {
      continue
    }

    const suffix = HONORIFIC_SUFFIXES[term.office_code]
    if (suffix) {
      suffixes.add(suffix)
    }
  }

  return [...suffixes].sort((a, b) => a.localeCompare(b))
}
