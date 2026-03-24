export type MeetingKindCode = 'general_meeting' | 'executive_meeting';

export function isMeetingKind(value: string | null | undefined): value is MeetingKindCode {
  return value === 'general_meeting' || value === 'executive_meeting';
}

export function getEventKindLabel(kind: string | null | undefined) {
  if (kind === 'general_meeting') return 'General meeting';
  if (kind === 'executive_meeting') return 'Executive meeting';
  return 'Standard event';
}

export function getEventKindAudienceLabel(kind: string | null | undefined) {
  if (kind === 'executive_meeting') return 'Officers only';
  if (kind === 'general_meeting') return 'All members';
  return 'Standard audience';
}

export function formatMeetingDateTimeRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const timeFormatter = new Intl.DateTimeFormat('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (sameDay) {
    return `${dateFormatter.format(start)} • ${timeFormatter.format(start)} to ${timeFormatter.format(end)}`;
  }

  return `${dateFormatter.format(start)} ${timeFormatter.format(start)} to ${dateFormatter.format(end)} ${timeFormatter.format(end)}`;
}

export function escapeIcsText(value: string | null | undefined) {
  return (value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function toIcsUtc(value: string) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  const hour = `${date.getUTCHours()}`.padStart(2, '0');
  const minute = `${date.getUTCMinutes()}`.padStart(2, '0');
  const second = `${date.getUTCSeconds()}`.padStart(2, '0');
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}
