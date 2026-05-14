#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const filePath = path.join(process.cwd(), 'app/events/[id]/page.tsx')
let text = readFileSync(filePath, 'utf8')

const eventQueryBefore = `  let eventQuery = supabase
    .from('events')
    .select(
      'id, local_unit_id, council_id, title, description, location_name, location_address, starts_at, ends_at, status_code, scope_code, event_kind_code, requires_rsvp, needs_volunteers, rsvp_deadline_at, volunteer_deadline_at, reminder_enabled, reminder_scheduled_for'
    )
    .eq('id', id);

  eventQuery = localUnitId
    ? eventQuery.eq('local_unit_id', localUnitId)
    : eventQuery.eq('council_id', council.id);

  let { data: eventData, error: eventError } = await eventQuery.single();

  if ((eventError || !eventData) && localUnitId) {
    const fallback = await supabase
      .from('events')
      .select(
        'id, local_unit_id, council_id, title, description, location_name, location_address, starts_at, ends_at, status_code, scope_code, event_kind_code, requires_rsvp, needs_volunteers, rsvp_deadline_at, volunteer_deadline_at, reminder_enabled, reminder_scheduled_for'
      )
      .eq('id', id)
      .eq('council_id', council.id)
      .is('local_unit_id', null)
      .single();

    eventData = fallback.data;
    eventError = fallback.error;
  }
`

const eventQueryAfter = `  if (!localUnitId) {
    notFound();
  }

  const { data: eventData, error: eventError } = await supabase
    .from('events')
    .select(
      'id, local_unit_id, council_id, title, description, location_name, location_address, starts_at, ends_at, status_code, scope_code, event_kind_code, requires_rsvp, needs_volunteers, rsvp_deadline_at, volunteer_deadline_at, reminder_enabled, reminder_scheduled_for'
    )
    .eq('id', id)
    .eq('local_unit_id', localUnitId)
    .single();
`

const peopleQueryBefore = `      localUnitId
        ? supabase
            .from('people')
            .select(
              'id, first_name, last_name, directory_display_name_override, email, cell_phone'
            )
            .is('archived_at', null)
            .is('merged_into_person_id', null)
            .order('last_name', { ascending: true })
            .order('first_name', { ascending: true })
            .returns<PersonRow[]>()
        : supabase
            .from('people')
            .select(
              'id, first_name, last_name, directory_display_name_override, email, cell_phone'
            )
            .eq('council_id', council.id)
            .is('archived_at', null)
            .is('merged_into_person_id', null)
            .order('last_name', { ascending: true })
            .order('first_name', { ascending: true })
            .returns<PersonRow[]>(),
`

const peopleQueryAfter = `      supabase
        .from('people')
        .select(
          'id, first_name, last_name, directory_display_name_override, email, cell_phone'
        )
        .is('archived_at', null)
        .is('merged_into_person_id', null)
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true })
        .returns<PersonRow[]>(),
`

const scopedPeopleBefore = `    const decryptedPeople = decryptPeopleRecords(peopleData ?? [])
    const scopedPeople = localUnitId
      ? decryptedPeople.filter((person) => scopedPersonIds.has(person.id))
      : decryptedPeople
`

const scopedPeopleAfter = `    const decryptedPeople = decryptPeopleRecords(peopleData ?? [])
    const scopedPeople = decryptedPeople.filter((person) => scopedPersonIds.has(person.id))
`

const replacements = [
  ['event detail event query', eventQueryBefore, eventQueryAfter],
  ['event detail people query', peopleQueryBefore, peopleQueryAfter],
  ['event detail scoped people filter', scopedPeopleBefore, scopedPeopleAfter],
]

for (const [label, before, after] of replacements) {
  if (!text.includes(before)) {
    console.error(`Missing expected block: ${label}`)
    process.exit(1)
  }
  text = text.replace(before, after)
}

writeFileSync(filePath, text, 'utf8')
console.log('Patched app/events/[id]/page.tsx to require localUnitId and remove council_id fallbacks.')
