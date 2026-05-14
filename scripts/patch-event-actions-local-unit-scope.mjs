#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const filePath = path.join(process.cwd(), 'app/events/actions.ts')
let text = readFileSync(filePath, 'utf8')

const replacements = [
  [
    'loadOwnedEvent local-unit-only',
    `async function loadOwnedEvent(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  eventId: string;
  localUnitId: string | null;
  councilId: string;
}) {
  const { supabase, eventId, localUnitId, councilId } = args;

  const selectClause =
    'id, local_unit_id, council_id, status_code, title, description, location_name, location_address, starts_at, ends_at, scope_code, event_kind_code, requires_rsvp, needs_volunteers, rsvp_deadline_at, volunteer_deadline_at, reminder_enabled, reminder_scheduled_for, reminder_days_before';

  if (localUnitId) {
    const { data, error } = await supabase
      .from('events')
      .select(selectClause)
      .eq('id', eventId)
      .eq('local_unit_id', localUnitId)
      .single();

    const event = data as EventRow | null;
    if (!error && event) return event;
  }

  const { data, error } = await supabase
    .from('events')
    .select(selectClause)
    .eq('id', eventId)
    .eq('council_id', councilId)
    .is('local_unit_id', null)
    .single();

  const event = data as EventRow | null;
  if (error || !event) throw new Error('Could not load that event.');
  return event;
}
`,
    `async function loadOwnedEvent(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  eventId: string;
  localUnitId: string | null;
  councilId: string;
}) {
  const { supabase, eventId, localUnitId } = args;

  if (!localUnitId) {
    throw new Error('Could not load your local organization context.');
  }

  const selectClause =
    'id, local_unit_id, council_id, status_code, title, description, location_name, location_address, starts_at, ends_at, scope_code, event_kind_code, requires_rsvp, needs_volunteers, rsvp_deadline_at, volunteer_deadline_at, reminder_enabled, reminder_scheduled_for, reminder_days_before';

  const { data, error } = await supabase
    .from('events')
    .select(selectClause)
    .eq('id', eventId)
    .eq('local_unit_id', localUnitId)
    .single();

  const event = data as EventRow | null;
  if (error || !event) throw new Error('Could not load that event.');
  return event;
}
`,
  ],
  [
    'updateEvent local-unit-only',
    `  let updateQuery = supabase
    .from('events')
    .update({
      title: eventInput.title,
      description: eventInput.description,
      location_name: eventInput.location_name,
      location_address: eventInput.location_address,
      starts_at: eventInput.starts_at,
      ends_at: eventInput.ends_at,
      display_timezone: eventInput.display_timezone,
      status_code: nextStatusCode,
      scope_code: eventInput.scope_code,
      event_kind_code: eventInput.event_kind_code,
      requires_rsvp: eventInput.requires_rsvp,
      needs_volunteers: eventInput.needs_volunteers,
      rsvp_deadline_at: eventInput.rsvp_deadline_at,
      volunteer_deadline_at: eventInput.volunteer_deadline_at,
      reminder_enabled: eventInput.reminder_enabled,
      reminder_scheduled_for: eventInput.reminder_scheduled_for,
      reminder_days_before: eventInput.reminder_days_before,
      updated_by_user_id: appUser.id,
    })
    .eq('id', eventId);

  updateQuery = localUnitId
    ? updateQuery.eq('local_unit_id', localUnitId)
    : updateQuery.eq('council_id', council.id);

  const { data, error: updateError } = await updateQuery
    .select(
      'id, local_unit_id, council_id, status_code, title, description, location_name, location_address, starts_at, ends_at, scope_code, event_kind_code, requires_rsvp, needs_volunteers, rsvp_deadline_at, volunteer_deadline_at, reminder_enabled, reminder_scheduled_for, reminder_days_before'
    )
    .single();
`,
    `  if (!localUnitId) {
    throw new Error('Could not load your local organization context.');
  }

  const { data, error: updateError } = await supabase
    .from('events')
    .update({
      title: eventInput.title,
      description: eventInput.description,
      location_name: eventInput.location_name,
      location_address: eventInput.location_address,
      starts_at: eventInput.starts_at,
      ends_at: eventInput.ends_at,
      display_timezone: eventInput.display_timezone,
      status_code: nextStatusCode,
      scope_code: eventInput.scope_code,
      event_kind_code: eventInput.event_kind_code,
      requires_rsvp: eventInput.requires_rsvp,
      needs_volunteers: eventInput.needs_volunteers,
      rsvp_deadline_at: eventInput.rsvp_deadline_at,
      volunteer_deadline_at: eventInput.volunteer_deadline_at,
      reminder_enabled: eventInput.reminder_enabled,
      reminder_scheduled_for: eventInput.reminder_scheduled_for,
      reminder_days_before: eventInput.reminder_days_before,
      updated_by_user_id: appUser.id,
    })
    .eq('id', eventId)
    .eq('local_unit_id', localUnitId)
    .select(
      'id, local_unit_id, council_id, status_code, title, description, location_name, location_address, starts_at, ends_at, scope_code, event_kind_code, requires_rsvp, needs_volunteers, rsvp_deadline_at, volunteer_deadline_at, reminder_enabled, reminder_scheduled_for, reminder_days_before'
    )
    .single();
`,
  ],
  [
    'duplicate archived local-unit-only',
    `  let archiveQuery = supabase
    .from('event_archives')
    .select(
      'id, council_id, local_unit_id, title, description, location_name, location_address, starts_at, ends_at, scope_code, event_kind_code, requires_rsvp, needs_volunteers, rsvp_deadline_at, volunteer_deadline_at, reminder_enabled, reminder_scheduled_for, reminder_days_before'
    )
    .eq('id', archiveId);

  archiveQuery = localUnitId
    ? archiveQuery.eq('local_unit_id', localUnitId)
    : archiveQuery.eq('council_id', council.id);

  const { data, error } = await archiveQuery.single();
`,
    `  if (!localUnitId) {
    throw new Error('Could not load your local organization context.');
  }

  const { data, error } = await supabase
    .from('event_archives')
    .select(
      'id, council_id, local_unit_id, title, description, location_name, location_address, starts_at, ends_at, scope_code, event_kind_code, requires_rsvp, needs_volunteers, rsvp_deadline_at, volunteer_deadline_at, reminder_enabled, reminder_scheduled_for, reminder_days_before'
    )
    .eq('id', archiveId)
    .eq('local_unit_id', localUnitId)
    .single();
`,
  ],
  [
    'delete event local-unit-only',
    `  let deleteQuery = supabase.from('events').delete().eq('id', eventId);
  deleteQuery = localUnitId
    ? deleteQuery.eq('local_unit_id', localUnitId)
    : deleteQuery.eq('council_id', council.id);

  const { error } = await deleteQuery;
`,
    `  if (!localUnitId) {
    throw new Error('Could not load your local organization context.');
  }

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)
    .eq('local_unit_id', localUnitId);
`,
  ],
  [
    'selected person lookup local-unit bridge',
    `    let personQuery = supabase
      .from('people')
      .select(
        'id, first_name, last_name, directory_display_name_override, email, cell_phone, home_phone, other_phone'
      )
      .eq('id', selectedPersonId)
      .is('archived_at', null)
      .is('merged_into_person_id', null);

    personQuery = personQuery.eq('council_id', council.id);

    const { data: personData, error: personError } = await personQuery.single();
`,
    `    const { data: localUnitPersonData, error: localUnitPersonError } = await supabase
      .from('local_unit_people')
      .select('person_id')
      .eq('local_unit_id', event.local_unit_id)
      .eq('person_id', selectedPersonId)
      .is('ended_at', null)
      .maybeSingle();

    if (localUnitPersonError || !localUnitPersonData?.person_id) {
      throw new Error('Could not load the selected member.');
    }

    const { data: personData, error: personError } = await supabase
      .from('people')
      .select(
        'id, first_name, last_name, directory_display_name_override, email, cell_phone, home_phone, other_phone'
      )
      .eq('id', selectedPersonId)
      .is('archived_at', null)
      .is('merged_into_person_id', null)
      .single();
`,
  ],
  [
    'selected person contact update no council filter',
    `      const { error: updatePersonError } = await supabase
        .from('people')
        .update(protectPeoplePayload({ email: primaryEmail, cell_phone: primaryPhone }))
        .eq('id', person.id)
        .eq('council_id', council.id);
`,
    `      const { error: updatePersonError } = await supabase
        .from('people')
        .update(protectPeoplePayload({ email: primaryEmail, cell_phone: primaryPhone }))
        .eq('id', person.id);
`,
  ],
  [
    'matched person lookup no council filter',
    `    const { data: personData, error: personError } = await supabase
      .from('people')
      .select('id, email, cell_phone, home_phone, other_phone')
      .eq('id', submission.matched_person_id)
      .eq('council_id', council.id)
      .maybeSingle();
`,
    `    const { data: localUnitPersonData, error: localUnitPersonError } = await supabase
      .from('local_unit_people')
      .select('person_id')
      .eq('local_unit_id', event.local_unit_id)
      .eq('person_id', submission.matched_person_id)
      .is('ended_at', null)
      .maybeSingle();

    if (localUnitPersonError) throw new Error(`Could not verify member local organization: ${localUnitPersonError.message}`);

    const { data: personData, error: personError } = localUnitPersonData?.person_id
      ? await supabase
          .from('people')
          .select('id, email, cell_phone, home_phone, other_phone')
          .eq('id', submission.matched_person_id)
          .maybeSingle()
      : { data: null, error: null };
`,
  ],
  [
    'matched person contact update no council filter',
    `        const { error: updatePersonError } = await supabase
          .from('people')
          .update(protectPeoplePayload({
            email: nextEmail,
            cell_phone: nextPhone,
          }))
          .eq('id', person.id)
          .eq('council_id', council.id);
`,
    `        const { error: updatePersonError } = await supabase
          .from('people')
          .update(protectPeoplePayload({
            email: nextEmail,
            cell_phone: nextPhone,
          }))
          .eq('id', person.id);
`,
  ],
]

for (const [label, before, after] of replacements) {
  if (!text.includes(before)) {
    console.error(`Missing expected block: ${label}`)
    process.exit(1)
  }
  text = text.replace(before, after)
}

writeFileSync(filePath, text, 'utf8')
console.log('Patched app/events/actions.ts to remove event write-path council_id fallbacks.')
