export type AnnualTermMode = 'calendar' | 'custom'

export type ReportingYearSettings = {
  year_label: string
  year_start_month: number
  year_start_day: number
}

export type AnnualTermSettings = ReportingYearSettings & {
  annual_term_mode?: AnnualTermMode
}

export type OrganizationAnnualTermSource = {
  annual_term_mode?: string | null
  annual_term_label?: string | null
  annual_term_start_month?: number | null
  annual_term_start_day?: number | null
  org_type_code?: string | null
  organization_type_code?: string | null
}

export type ReportingYearTermRange = {
  startDate: string
  endDate: string | null
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

function reportingYearBoundaryDate(year: number, settings: ReportingYearSettings) {
  return `${year}-${padDatePart(settings.year_start_month)}-${padDatePart(settings.year_start_day)}`
}

function isKnightsOrganizationType(orgTypeCode?: string | null) {
  return orgTypeCode === 'knights_of_columbus' || orgTypeCode === 'kofc_council'
}

function isValidAnnualTermStart(month: number | null | undefined, day: number | null | undefined) {
  if (!Number.isInteger(month) || !Number.isInteger(day)) return false
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return false
  const candidate = new Date(Date.UTC(2024, month - 1, day, 12, 0, 0))
  return candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day
}

export function getDefaultReportingYearSettings(orgTypeCode?: string | null): ReportingYearSettings {
  if (isKnightsOrganizationType(orgTypeCode)) {
    return {
      year_label: 'Fraternal Year',
      year_start_month: 7,
      year_start_day: 1,
    }
  }

  return {
    year_label: 'Calendar Year',
    year_start_month: 1,
    year_start_day: 1,
  }
}

export function getOrganizationAnnualTermSettings(
  source?: OrganizationAnnualTermSource | null
): AnnualTermSettings {
  const orgTypeCode = source?.org_type_code ?? source?.organization_type_code ?? null
  const fallback = getDefaultReportingYearSettings(orgTypeCode)
  const mode = source?.annual_term_mode === 'custom' ? 'custom' : 'calendar'

  if (
    mode === 'custom' &&
    isValidAnnualTermStart(source?.annual_term_start_month, source?.annual_term_start_day)
  ) {
    return {
      annual_term_mode: 'custom',
      year_label: source?.annual_term_label?.trim() || fallback.year_label,
      year_start_month: source!.annual_term_start_month!,
      year_start_day: source!.annual_term_start_day!,
    }
  }

  if (mode === 'calendar') {
    return {
      annual_term_mode: 'calendar',
      year_label: source?.annual_term_label?.trim() || 'Calendar Year',
      year_start_month: 1,
      year_start_day: 1,
    }
  }

  return {
    annual_term_mode: 'custom',
    ...fallback,
  }
}

export function buildReportingYearRange(settings: ReportingYearSettings, today = new Date()) {
  const currentYear = today.getFullYear()
  const startThisYear = new Date(Date.UTC(currentYear, settings.year_start_month - 1, settings.year_start_day, 12, 0, 0))
  const startYear = today.getTime() >= startThisYear.getTime() ? currentYear : currentYear - 1
  const start = new Date(Date.UTC(startYear, settings.year_start_month - 1, settings.year_start_day, 12, 0, 0))
  const end = new Date(Date.UTC(startYear + 1, settings.year_start_month - 1, settings.year_start_day, 12, 0, 0))
  const displayEnd = new Date(end)
  displayEnd.setUTCDate(displayEnd.getUTCDate() - 1)

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    displayEndDate: displayEnd.toISOString().slice(0, 10),
    label: `${settings.year_label} ${startYear}-${String(startYear + 1).slice(-2)}`,
  }
}

export const buildAnnualTermRange = buildReportingYearRange

export function buildReportingYearTermRange(args: {
  settings: ReportingYearSettings
  startYear: number
  endYear: number | null
}): ReportingYearTermRange {
  const startDate = reportingYearBoundaryDate(args.startYear, args.settings)

  if (args.endYear == null) {
    return {
      startDate,
      endDate: null,
    }
  }

  const exclusiveEndYear = args.endYear <= args.startYear ? args.startYear + 1 : args.endYear

  return {
    startDate,
    endDate: reportingYearBoundaryDate(exclusiveEndYear, args.settings),
  }
}

export function reportingYearTermRangesOverlap(
  first: ReportingYearTermRange,
  second: ReportingYearTermRange
) {
  const firstEnd = first.endDate ?? '9999-12-31'
  const secondEnd = second.endDate ?? '9999-12-31'

  return first.startDate < secondEnd && second.startDate < firstEnd
}
