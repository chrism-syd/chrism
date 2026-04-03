const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const TIME_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  hour: 'numeric',
  minute: '2-digit',
})

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

export function formatEventDateRange(startsAt?: string | null) {
  const start = parseDate(startsAt)

  if (!start) {
    return 'Date not available'
  }

  return DATE_FORMATTER.format(start)
}

export function formatEventDateTimeRange(startsAt?: string | null, endsAt?: string | null) {
  const start = parseDate(startsAt)
  const end = parseDate(endsAt)

  if (!start) {
    return 'Date not available'
  }

  if (!end) {
    return `${DATE_FORMATTER.format(start)} • ${TIME_FORMATTER.format(start)}`
  }

  if (isSameCalendarDay(start, end)) {
    return `${DATE_FORMATTER.format(start)} • ${TIME_FORMATTER.format(start)} to ${TIME_FORMATTER.format(end)}`
  }

  return `${DATE_FORMATTER.format(start)} ${TIME_FORMATTER.format(start)} to ${DATE_FORMATTER.format(end)} ${TIME_FORMATTER.format(end)}`
}
