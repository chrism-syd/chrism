import { DEFAULT_EVENT_TIME_ZONE } from './time-zone'

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

const MEETING_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: DEFAULT_EVENT_TIME_ZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const MEETING_TIME_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: DEFAULT_EVENT_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

const MEETING_CALENDAR_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: DEFAULT_EVENT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatMeetingDateTimeRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const sameDay = MEETING_CALENDAR_DAY_FORMATTER.format(start) === MEETING_CALENDAR_DAY_FORMATTER.format(end);

  if (sameDay) {
    return `${MEETING_DATE_FORMATTER.format(start)} • ${MEETING_TIME_FORMATTER.format(start)} to ${MEETING_TIME_FORMATTER.format(end)}`;
  }

  return `${MEETING_DATE_FORMATTER.format(start)} ${MEETING_TIME_FORMATTER.format(start)} to ${MEETING_DATE_FORMATTER.format(end)} ${MEETING_TIME_FORMATTER.format(end)}`;
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
