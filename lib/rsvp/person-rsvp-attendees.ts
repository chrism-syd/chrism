export type PersonRsvpSourceCode = 'host_manual' | 'email_link' | 'public_link'

export type ResolvedPersonRsvpAttendeeInput = {
  matched_person_id: string | null
  attendee_name: string
  attendee_email: string | null
  attendee_phone: string | null
  uses_primary_contact: boolean
  is_volunteer: boolean
  sort_order: number
}

export type PersonRsvpAttendeeInsertRow = {
  event_person_rsvp_id: string
  matched_person_id: string | null
  attendee_name: string
  attendee_email: string | null
  attendee_phone: string | null
  uses_primary_contact: boolean
  is_primary: boolean
  is_volunteer: boolean
  sort_order: number
}

export function buildPersonRsvpAttendeeRows(args: {
  submissionId: string
  matchedPrimaryPersonId: string | null
  primaryName: string
  normalizedPrimaryEmail: string | null
  primaryPhone: string | null
  primaryIsVolunteer?: boolean
  sourceCode: PersonRsvpSourceCode
  attendees: ResolvedPersonRsvpAttendeeInput[]
}): PersonRsvpAttendeeInsertRow[] {
  const {
    submissionId,
    matchedPrimaryPersonId,
    primaryName,
    normalizedPrimaryEmail,
    primaryPhone,
    primaryIsVolunteer = false,
    sourceCode,
    attendees,
  } = args

  return [
    {
      event_person_rsvp_id: submissionId,
      matched_person_id: matchedPrimaryPersonId,
      attendee_name: primaryName,
      attendee_email: normalizedPrimaryEmail,
      attendee_phone: primaryPhone,
      uses_primary_contact: true,
      is_primary: true,
      is_volunteer: sourceCode === 'host_manual' || primaryIsVolunteer,
      sort_order: 0,
    },
    ...attendees.map((attendee) => ({
      event_person_rsvp_id: submissionId,
      matched_person_id: attendee.matched_person_id,
      attendee_name: attendee.attendee_name,
      attendee_email: attendee.attendee_email,
      attendee_phone: attendee.attendee_phone,
      uses_primary_contact: attendee.uses_primary_contact,
      is_primary: false,
      is_volunteer: attendee.is_volunteer,
      sort_order: attendee.sort_order,
    })),
  ]
}

export function countVolunteerAttendeeRows(rows: Array<{ is_volunteer: boolean }>) {
  return rows.filter((row) => row.is_volunteer).length
}

export function hasVolunteerAttendee(rows: Array<{ is_volunteer: boolean }>) {
  return rows.some((row) => row.is_volunteer)
}
