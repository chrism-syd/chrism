export type ReportingYearSettings = {
  year_label: string
  year_start_month: number
  year_start_day: number
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

export function getDefaultReportingYearSettings(orgTypeCode?: string | null): ReportingYearSettings {
  if (orgTypeCode === 'knights_of_columbus') {
    return {
      year_label: 'Fraternal year',
      year_start_month: 7,
      year_start_day: 1,
    }
  }

  return {
    year_label: 'Calendar year',
    year_start_month: 1,
    year_start_day: 1,
  }
}

export function buildReportingYearRange(settings: ReportingYearSettings, today = new Date()) {
  const currentYear = today.getFullYear()
  const startThisYear = new Date(Date.UTC(currentYear, settings.year_start_month - 1, settings.year_start_day, 12, 0, 0))
  const startYear = today.getTime() >= startThisYear.getTime() ? currentYear : currentYear - 1
  const start = new Date(Date.UTC(startYear, settings.year_start_month - 1, settings.year_start_day, 12, 0, 0))
  const end = new Date(Date.UTC(startYear + 1, settings.year_start_month - 1, settings.year_start_day, 12, 0, 0))

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    label: `${settings.year_label} ${startYear}-${String(startYear + 1).slice(-2)}`,
  }
}

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
