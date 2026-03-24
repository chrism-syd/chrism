'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserPermissions } from '@/lib/auth/permissions';
import { isValidEmailAddress } from '@/lib/security/contact-validation';
import {
  decryptPeopleRecord,
  decryptProfileChangeRequestRecord,
  protectProfileChangeRequestPayload,
} from '@/lib/security/pii';

type ActionResult = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

type PendingProfileChangeRequestRow = {
  id: string;
  proposed_email: string | null;
  proposed_cell_phone: string | null;
  proposed_home_phone: string | null;
  email_change_requested: boolean;
  cell_phone_change_requested: boolean;
  home_phone_change_requested: boolean;
};

function normalizeText(value: FormDataEntryValue | string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function valuesDiffer(a: string | null, b: string | null) {
  return normalizeText(a) !== normalizeText(b);
}

function resolveDesiredContactValue(args: {
  submitted: boolean;
  submittedValue: string | null;
  current: string | null;
  pending: string | null;
  pendingRequested: boolean;
}) {
  if (args.submitted) {
    return args.submittedValue;
  }

  if (args.pendingRequested) {
    return args.pending;
  }

  return args.current;
}

function toStoredPendingValue(desired: string | null, current: string | null) {
  return valuesDiffer(desired, current) ? desired : null;
}

export async function submitProfileChangeRequest(
  _previousState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const permissions = await getCurrentUserPermissions();
  const user = permissions.authUser;

  if (!user) {
    return {
      status: 'error',
      message: 'Please sign in again before sending updates for review.',
    };
  }

  const admin = createAdminClient();
  const personId = permissions.personId ?? null;

  if (!personId) {
    return {
      status: 'error',
      message: 'Your profile is not linked to a member record yet, so there is nothing to review.',
    };
  }

  const { data: personData, error: personError } = await admin
    .from('people')
    .select('email, cell_phone, home_phone, nickname')
    .eq('id', personId)
    .maybeSingle();

  const person = personData ? decryptPeopleRecord(personData) : null;

  if (personError || !person) {
    return {
      status: 'error',
      message: 'We could not load your current profile details right now. Please try again.',
    };
  }

  const submittedEmail = formData.has('email');
  const submittedCellPhone = formData.has('cell_phone');
  const submittedHomePhone = formData.has('home_phone');
  const submittedPreferredName = formData.has('preferred_name');

  const submittedEmailValue = submittedEmail ? normalizeText(formData.get('email')) : null;
  const submittedCellPhoneValue = submittedCellPhone ? normalizeText(formData.get('cell_phone')) : null;
  const submittedHomePhoneValue = submittedHomePhone ? normalizeText(formData.get('home_phone')) : null;
  const submittedPreferredNameValue = submittedPreferredName ? normalizeText(formData.get('preferred_name')) : null;

  if (submittedEmailValue && !isValidEmailAddress(submittedEmailValue)) {
    return {
      status: 'error',
      message: 'Enter a valid email address before saving your contact updates.',
    };
  }

  const currentEmail = normalizeText(person.email as string | null);
  const currentCellPhone = normalizeText(person.cell_phone as string | null);
  const currentHomePhone = normalizeText(person.home_phone as string | null);
  const currentPreferredName = normalizeText(person.nickname as string | null);

  const { data: existingPendingData } = await admin
    .from('person_profile_change_requests')
    .select(
      'id, proposed_email, proposed_cell_phone, proposed_home_phone, email_change_requested, cell_phone_change_requested, home_phone_change_requested'
    )
    .eq('person_id', personId)
    .eq('status_code', 'pending')
    .maybeSingle<PendingProfileChangeRequestRow>();

  const existingPending = existingPendingData ? decryptProfileChangeRequestRecord(existingPendingData) : null;

  const existingPendingEmail = normalizeText(existingPending?.proposed_email);
  const existingPendingCellPhone = normalizeText(existingPending?.proposed_cell_phone);
  const existingPendingHomePhone = normalizeText(existingPending?.proposed_home_phone);

  const stalePendingRequest = Boolean(
    existingPending?.id &&
      !(
        (existingPending.email_change_requested && valuesDiffer(existingPendingEmail, currentEmail)) ||
        (existingPending.cell_phone_change_requested && valuesDiffer(existingPendingCellPhone, currentCellPhone)) ||
        (existingPending.home_phone_change_requested && valuesDiffer(existingPendingHomePhone, currentHomePhone))
      ),
  );

  const activePending = stalePendingRequest ? null : existingPending;

  const desiredEmail = resolveDesiredContactValue({
    submitted: submittedEmail,
    submittedValue: submittedEmailValue,
    current: currentEmail,
    pending: normalizeText(activePending?.proposed_email),
    pendingRequested: Boolean(activePending?.email_change_requested),
  });
  const desiredCellPhone = resolveDesiredContactValue({
    submitted: submittedCellPhone,
    submittedValue: submittedCellPhoneValue,
    current: currentCellPhone,
    pending: normalizeText(activePending?.proposed_cell_phone),
    pendingRequested: Boolean(activePending?.cell_phone_change_requested),
  });
  const desiredHomePhone = resolveDesiredContactValue({
    submitted: submittedHomePhone,
    submittedValue: submittedHomePhoneValue,
    current: currentHomePhone,
    pending: normalizeText(activePending?.proposed_home_phone),
    pendingRequested: Boolean(activePending?.home_phone_change_requested),
  });
  const desiredPreferredName = submittedPreferredName ? submittedPreferredNameValue : currentPreferredName;

  const emailChangeRequested = valuesDiffer(desiredEmail, currentEmail);
  const cellPhoneChangeRequested = valuesDiffer(desiredCellPhone, currentCellPhone);
  const homePhoneChangeRequested = valuesDiffer(desiredHomePhone, currentHomePhone);
  const contactChanges = emailChangeRequested || cellPhoneChangeRequested || homePhoneChangeRequested;
  const preferredNameChanged = valuesDiffer(desiredPreferredName, currentPreferredName);

  if (!contactChanges && !preferredNameChanged && !stalePendingRequest) {
    return {
      status: 'error',
      message: 'There are no new changes to send for review yet.',
    };
  }

  if (preferredNameChanged) {
    const { error: preferredNameError } = await admin
      .from('people')
      .update({ nickname: desiredPreferredName })
      .eq('id', personId);

    if (preferredNameError) {
      return {
        status: 'error',
        message: 'Could not update preferred name right now. Please try again.',
      };
    }
  }

  if (stalePendingRequest && existingPending?.id) {
    const { error: stalePendingDeleteError } = await admin
      .from('person_profile_change_requests')
      .delete()
      .eq('id', existingPending.id);

    if (stalePendingDeleteError) {
      return {
        status: 'error',
        message: 'We could not clean up your old pending contact update right now. Please try again.',
      };
    }
  }

  let result: { error: unknown } | null = null;

  if (contactChanges) {
    const payload = protectProfileChangeRequestPayload({
      person_id: personId,
      requested_by_auth_user_id: user.id,
      requested_at: new Date().toISOString(),
      status_code: 'pending',
      proposed_email: toStoredPendingValue(desiredEmail, currentEmail),
      proposed_cell_phone: toStoredPendingValue(desiredCellPhone, currentCellPhone),
      proposed_home_phone: toStoredPendingValue(desiredHomePhone, currentHomePhone),
      proposed_preferred_name: null,
      email_change_requested: emailChangeRequested,
      cell_phone_change_requested: cellPhoneChangeRequested,
      home_phone_change_requested: homePhoneChangeRequested,
    });

    result = activePending?.id
      ? await admin.from('person_profile_change_requests').update(payload).eq('id', activePending.id)
      : await admin.from('person_profile_change_requests').insert(payload);
  }

  if (!contactChanges && activePending?.id) {
    result = await admin.from('person_profile_change_requests').delete().eq('id', activePending.id);
  }

  if (result?.error) {
    return {
      status: 'error',
      message: contactChanges
        ? 'We could not send your updates for review just now. Please try again.'
        : 'We could not clear your pending contact changes right now. Please try again.',
    };
  }

  revalidatePath('/me');
  revalidatePath('/members/reviews');

  return {
    status: 'success',
    message: contactChanges
      ? preferredNameChanged
        ? 'Your contact info changes have been sent for review. Preferred name was updated immediately.'
        : 'Your contact info changes have been sent for review.'
      : preferredNameChanged
        ? 'Your preferred name has been updated successfully.'
        : 'Your pending contact changes were cleared.',
  };
}
