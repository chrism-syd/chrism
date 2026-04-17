'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getCurrentActingCouncilContext, getCurrentActingCouncilContextForEvent } from '@/lib/auth/acting-context';
import { savePersonRsvpSubmission } from '@/lib/rsvp/person-rsvp';
import { decryptPeopleRecord, protectPeoplePayload } from '@/lib/security/pii';

/* keep existing file content above unchanged in your real file */

export async function addHostManualVolunteer(
  eventId: string,
  returnTo: 'detail' | 'volunteers' = 'detail',
  formData: FormData
) {
  const { supabase, council, appUser, localUnitId } = await getCurrentAppContext({ eventId, redirectTo: '/events' });
  const event = await loadOwnedEvent({
    supabase,
    eventId,
    localUnitId,
    councilId: council.id,
  });

  if (event.scope_code !== 'home_council_only') {
    throw new Error('Host manual volunteer entry is only available for home council only events.');
  }

  if (event.rsvp_deadline_at && new Date(event.rsvp_deadline_at).getTime() < Date.now()) {
    throw new Error('The RSVP deadline for this event has passed.');
  }

  const selectedPersonId = nullableString(formData.get('selected_person_id'));
  let matchedPersonId: string | null = null;

  let primaryName = normalizeString(formData.get('primary_name'));
  let primaryEmail = normalizeEmail(formData.get('primary_email'));
  let primaryPhone = nullableString(formData.get('primary_phone'));
  const responseNotes = nullableString(formData.get('response_notes'));

  if (selectedPersonId) {
    if (localUnitId) {
      const { data: scopedRow, error: scopedError } = await supabase
        .from('local_unit_people')
        .select('person_id')
        .eq('local_unit_id', localUnitId)
        .eq('person_id', selectedPersonId)
        .is('ended_at', null)
        .maybeSingle<{ person_id: string }>()

      if (scopedError || !scopedRow?.person_id) {
        throw new Error('Could not load the selected member.');
      }
    }

    let personQuery = supabase
      .from('people')
      .select(
        'id, first_name, last_name, directory_display_name_override, email, cell_phone, home_phone, other_phone'
      )
      .eq('id', selectedPersonId)
      .is('archived_at', null)
      .is('merged_into_person_id', null);

    if (!localUnitId) {
      personQuery = personQuery.eq('council_id', council.id);
    }

    const { data: personData, error: personError } = await personQuery.single();

    const person = personData
      ? decryptPeopleRecord(personData as {
          id: string;
          first_name: string;
          last_name: string;
          directory_display_name_override: string | null;
          email: string | null;
          cell_phone: string | null;
          home_phone: string | null;
          other_phone: string | null;
        })
      : null;

    if (personError || !person) throw new Error('Could not load the selected member.');

    matchedPersonId = person.id;

    if (!primaryName) {
      primaryName = person.directory_display_name_override?.trim() || `${person.first_name} ${person.last_name}`.trim();
    }

    if (!primaryEmail) {
      primaryEmail = normalizeEmail(person.email);
    }

    if (!primaryPhone) {
      primaryPhone = nullableString(person.cell_phone);
    }

    const currentEmail = normalizeEmail(person.email);
    const currentPhone = nullableString(person.cell_phone);
    const currentHomePhone = nullableString(person.home_phone);
    const currentOtherPhone = nullableString(person.other_phone);

    if (primaryEmail !== currentEmail || primaryPhone !== currentPhone) {
      assertPeopleContactRequirement({
        email: primaryEmail,
        cellPhone: primaryPhone,
        homePhone: currentHomePhone,
        otherPhone: currentOtherPhone,
        contextLabel: 'This member',
      });

      let updateQuery = supabase
        .from('people')
        .update(protectPeoplePayload({ email: primaryEmail, cell_phone: primaryPhone }))
        .eq('id', person.id);

      if (!localUnitId) {
        updateQuery = updateQuery.eq('council_id', council.id);
      }

      const { error: updatePersonError } = await updateQuery;

      if (updatePersonError) {
        throw new Error(`Could not update member contact info: ${updatePersonError.message}`);
      }
    }
  }

  if (!primaryName) throw new Error('Volunteer name is required.');

  await savePersonRsvpSubmission({
    supabase,
    eventId: event.id,
    hostCouncilId: council.id,
    localUnitId,
    primaryName,
    primaryEmail,
    primaryPhone,
    responseNotes,
    attendees: [],
    sourceCode: 'host_manual',
    explicitMatchedPersonId: matchedPersonId,
  });

  await cancelPendingVolunteerMessageJobs({
    supabase,
    eventId: event.id,
    recipientEmail: primaryEmail,
  });

  await queueVolunteerMessageJob({
    supabase,
    event,
    createdByUserId: appUser.id,
    recipientEmail: primaryEmail,
    recipientName: primaryName,
    messageTypeCode: 'volunteer_confirmation',
  });

  await replaceVolunteerReminderJob({
    supabase,
    event,
    createdByUserId: appUser.id,
    recipientEmail: primaryEmail,
    recipientName: primaryName,
  });

  await revalidateEventVolunteerPaths({ supabase, eventId: event.id });

  redirect(returnTo === 'volunteers' ? `/events/${event.id}/volunteers` : `/events/${event.id}`);
}
