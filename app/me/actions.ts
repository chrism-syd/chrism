'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUserPermissions } from '@/lib/auth/permissions';
import { isValidEmailAddress } from '@/lib/security/contact-validation';
import {
  decryptPeopleRecord,
  decryptProfileChangeRequestRecord,
  protectPeoplePayload,
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

type PersonContactRow = {
  id: string;
  email: string | null;
  cell_phone: string | null;
  home_phone: string | null;
  nickname: string | null;
  first_name: string;
  last_name: string;
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
  if (args.submitted) return args.submittedValue;
  if (args.pendingRequested) return args.pending;
  return args.current;
}

function toStoredPendingValue(desired: string | null, current: string | null) {
  return valuesDiffer(desired, current) ? desired : null;
}

function inferNameParts(firstName: string | null, lastName: string | null, preferredName: string | null, email: string | null) {
  if (firstName && lastName) return { firstName, lastName };
  const source = preferredName?.trim() || email?.split('@')[0]?.replace(/[._-]+/g, ' ')?.trim() || 'Chrism User';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: firstName ?? parts[0], lastName: lastName ?? 'User' };
  return {
    firstName: firstName ?? parts.slice(0, -1).join(' '),
    lastName: lastName ?? parts.slice(-1).join(' '),
  };
}

async function saveStandaloneProfile(args: {
  admin: ReturnType<typeof createAdminClient>;
  authUserId: string;
  existingPerson: PersonContactRow | null;
  permissionsPersonId: string | null;
  submittedFirstNameValue: string | null;
  submittedLastNameValue: string | null;
  submittedPreferredNameValue: string | null;
  submittedEmailValue: string | null;
  submittedCellPhoneValue: string | null;
  submittedHomePhoneValue: string | null;
  authEmail: string | null;
}) {
  const {
    admin, authUserId, existingPerson, permissionsPersonId, submittedFirstNameValue, submittedLastNameValue,
    submittedPreferredNameValue, submittedEmailValue, submittedCellPhoneValue, submittedHomePhoneValue, authEmail,
  } = args;

  const desiredPreferredName = submittedPreferredNameValue ?? existingPerson?.nickname ?? null;
  const desiredEmail = submittedEmailValue ?? existingPerson?.email ?? authEmail ?? null;
  const desiredCellPhone = submittedCellPhoneValue ?? existingPerson?.cell_phone ?? null;
  const desiredHomePhone = submittedHomePhoneValue ?? existingPerson?.home_phone ?? null;
  const inferred = inferNameParts(
    submittedFirstNameValue ?? existingPerson?.first_name ?? null,
    submittedLastNameValue ?? existingPerson?.last_name ?? null,
    desiredPreferredName,
    desiredEmail ?? authEmail ?? null
  );

  const payload = protectPeoplePayload({
    council_id: null,
    first_name: inferred.firstName,
    last_name: inferred.lastName,
    email: desiredEmail,
    cell_phone: desiredCellPhone,
    home_phone: desiredHomePhone,
    nickname: desiredPreferredName,
    primary_relationship_code: 'member',
    created_source_code: 'admin_manual_member',
    is_provisional_member: true,
    created_by_auth_user_id: existingPerson ? undefined : authUserId,
    updated_by_auth_user_id: authUserId,
  });

  if (existingPerson?.id || permissionsPersonId) {
    const targetPersonId = existingPerson?.id ?? permissionsPersonId!;
    const { error } = await admin.from('people').update(payload).eq('id', targetPersonId);
    if (error) return { ok: false as const, message: 'We could not save your profile details right now. Please try again.' };
    return { ok: true as const, message: 'Your profile details have been saved.' };
  }

  const { data: insertedPerson, error: insertError } = await admin.from('people').insert(payload).select('id').maybeSingle<{ id: string }>();
  if (insertError || !insertedPerson?.id) {
    return { ok: false as const, message: 'We could not create your profile record right now. Please try again.' };
  }

  const { error: userUpdateError } = await admin.from('users').update({
    person_id: insertedPerson.id,
    updated_at: new Date().toISOString(),
  }).eq('id', authUserId);

  if (userUpdateError) {
    return { ok: true as const, message: 'Your profile details were saved, but the account link may take one refresh to catch up.' };
  }

  return { ok: true as const, message: 'Your profile details have been saved.' };
}

export async function submitProfileChangeRequest(
  _previousState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const permissions = await getCurrentUserPermissions();
  const user = permissions.authUser;
  if (!user) return { status: 'error', message: 'Please sign in again before saving profile updates.' };

  const admin = createAdminClient();
  const personId = permissions.personId ?? null;

  const submittedFirstName = formData.has('first_name');
  const submittedLastName = formData.has('last_name');
  const submittedEmail = formData.has('email');
  const submittedCellPhone = formData.has('cell_phone');
  const submittedHomePhone = formData.has('home_phone');
  const submittedPreferredName = formData.has('preferred_name');

  const submittedFirstNameValue = submittedFirstName ? normalizeText(formData.get('first_name')) : null;
  const submittedLastNameValue = submittedLastName ? normalizeText(formData.get('last_name')) : null;
  const submittedEmailValue = submittedEmail ? normalizeText(formData.get('email')) : null;
  const submittedCellPhoneValue = submittedCellPhone ? normalizeText(formData.get('cell_phone')) : null;
  const submittedHomePhoneValue = submittedHomePhone ? normalizeText(formData.get('home_phone')) : null;
  const submittedPreferredNameValue = submittedPreferredName ? normalizeText(formData.get('preferred_name')) : null;

  if (submittedEmailValue && !isValidEmailAddress(submittedEmailValue)) {
    return { status: 'error', message: 'Enter a valid email address before saving your contact updates.' };
  }

  const shouldSaveDirectly = !permissions.organizationId;
  if (shouldSaveDirectly) {
    const existingPersonResult = personId
      ? await admin.from('people').select('id, email, cell_phone, home_phone, nickname, first_name, last_name').eq('id', personId).maybeSingle<PersonContactRow>()
      : { data: null as PersonContactRow | null, error: null as unknown };

    if (existingPersonResult.error) {
      return { status: 'error', message: 'We could not load your profile details right now. Please try again.' };
    }

    const existingPerson = existingPersonResult.data ? decryptPeopleRecord(existingPersonResult.data) : null;

    const saveResult = await saveStandaloneProfile({
      admin,
      authUserId: user.id,
      existingPerson,
      permissionsPersonId: personId,
      submittedFirstNameValue,
      submittedLastNameValue,
      submittedPreferredNameValue,
      submittedEmailValue,
      submittedCellPhoneValue,
      submittedHomePhoneValue,
      authEmail: normalizeText(user.email),
    });

    revalidatePath('/me');
    return { status: saveResult.ok ? 'success' : 'error', message: saveResult.message };
  }

  if (!personId) {
    return { status: 'error', message: 'Your profile is not linked to a member record yet, so there is nothing to review.' };
  }

  const { data: personData, error: personError } = await admin
    .from('people').select('id, email, cell_phone, home_phone, nickname, first_name, last_name').eq('id', personId).maybeSingle<PersonContactRow>();
  const person = personData ? decryptPeopleRecord(personData) : null;
  if (personError || !person) {
    return { status: 'error', message: 'We could not load your current profile details right now. Please try again.' };
  }

  const currentEmail = normalizeText(person.email as string | null);
  const currentCellPhone = normalizeText(person.cell_phone as string | null);
  const currentHomePhone = normalizeText(person.home_phone as string | null);
  const currentPreferredName = normalizeText(person.nickname as string | null);

  const { data: existingPendingData } = await admin
    .from('person_profile_change_requests')
    .select('id, proposed_email, proposed_cell_phone, proposed_home_phone, email_change_requested, cell_phone_change_requested, home_phone_change_requested')
    .eq('person_id', personId).eq('status_code', 'pending').maybeSingle<PendingProfileChangeRequestRow>();

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
    return { status: 'error', message: 'There are no new changes to send for review yet.' };
  }

  if (preferredNameChanged) {
    const { error: preferredNameError } = await admin.from('people').update({ nickname: desiredPreferredName }).eq('id', personId);
    if (preferredNameError) return { status: 'error', message: 'Could not update preferred name right now. Please try again.' };
  }

  if (stalePendingRequest && existingPending?.id) {
    const { error: stalePendingDeleteError } = await admin.from('person_profile_change_requests').delete().eq('id', existingPending.id);
    if (stalePendingDeleteError) {
      return { status: 'error', message: 'We could not clean up your old pending contact update right now. Please try again.' };
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

export async function dismissOrganizationClaimNoticeAction(formData: FormData) {
  const permissions = await getCurrentUserPermissions();
  if (!permissions.authUser) redirect('/login');

  const claimId = normalizeText(formData.get('claim_id'));
  if (!claimId) redirect('/me');

  const admin = createAdminClient();
  const { error } = await admin
    .from('organization_claim_requests')
    .update({
      requester_notice_dismissed_at: new Date().toISOString(),
      requester_notice_dismissed_by_auth_user_id: permissions.authUser.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', claimId)
    .eq('requested_by_auth_user_id', permissions.authUser.id);

  if (error) {
    redirect('/me');
  }

  revalidatePath('/me');
  redirect('/me');
}
