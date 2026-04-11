'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context';
import { listValidMemberPersonIdsForLocalUnit } from '@/lib/custom-lists';
import { isValidEmailAddress } from '@/lib/security/contact-validation';
import { protectPeoplePayload } from '@/lib/security/pii';
import type { DeleteMemberState, MemberFormState, MemberFormValues } from './form-state';

function textValue(formData: FormData, key: keyof MemberFormValues) {
  const value = formData.get(key);
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function rawTextValue(formData: FormData, key: keyof MemberFormValues) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function collectMemberFormValues(formData: FormData): MemberFormValues {
  return {
    member_id: rawTextValue(formData, 'member_id'),
    first_name: rawTextValue(formData, 'first_name'),
    middle_name: rawTextValue(formData, 'middle_name'),
    last_name: rawTextValue(formData, 'last_name'),
    email: rawTextValue(formData, 'email'),
    cell_phone: rawTextValue(formData, 'cell_phone'),
    home_phone: rawTextValue(formData, 'home_phone'),
    other_phone: rawTextValue(formData, 'other_phone'),
    address_line_1: rawTextValue(formData, 'address_line_1'),
    address_line_2: rawTextValue(formData, 'address_line_2'),
    city: rawTextValue(formData, 'city'),
    state_province: rawTextValue(formData, 'state_province'),
    postal_code: rawTextValue(formData, 'postal_code'),
    council_activity_level_code: rawTextValue(formData, 'council_activity_level_code'),
    council_activity_context_code: rawTextValue(formData, 'council_activity_context_code'),
    council_reengagement_status_code: rawTextValue(formData, 'council_reengagement_status_code'),
  };
}

function hasAnyContactInfo(values: Pick<MemberFormValues, 'email' | 'cell_phone' | 'home_phone' | 'other_phone'>) {
  return [values.email, values.cell_phone, values.home_phone, values.other_phone].some(
    (value) => value.trim() !== ''
  );
}

function validateMemberFormValues(values: MemberFormValues) {
  if (!values.first_name.trim() || !values.last_name.trim()) {
    return 'First name and last name are required.';
  }

  if (!hasAnyContactInfo(values)) {
    return 'Add at least one contact method before saving: email, cell phone, home phone, or other phone.';
  }

  if (values.email.trim() && !isValidEmailAddress(values.email.trim())) {
    return 'Enter a valid email address before saving this member.';
  }

  return null;
}

function memberFormErrorState(values: MemberFormValues, error: string): MemberFormState {
  return {
    error,
    values,
  };
}

function friendlyPeopleConstraintMessage(message: string) {
  if (message.includes('people_contact_required_for_non_import')) {
    return 'Add at least one contact method before saving: email, cell phone, home phone, or other phone.';
  }

  if (message.toLowerCase().includes('permission denied for schema app')) {
    return 'We could not save this member because the local database is still missing one setup permission.';
  }

  return message;
}

async function getCurrentMemberAdminContext() {
  const { admin: supabase, permissions, localUnitId } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/members',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  });

  if (!permissions.authUser) {
    redirect('/login');
  }

  return {
    supabase,
    user: permissions.authUser,
    localUnitId,
  };
}

async function ensureActiveLocalUnitMember(args: {
  supabase: ReturnType<typeof getCurrentActingCouncilContext> extends Promise<infer _T> ? any : never
  localUnitId: string | null
  memberId: string
}) {
  if (!args.localUnitId) {
    return false;
  }

  const validPersonIds = await listValidMemberPersonIdsForLocalUnit({
    admin: args.supabase,
    localUnitId: args.localUnitId,
    personIds: [args.memberId],
  });

  return validPersonIds.includes(args.memberId);
}

async function getLegacyCouncilIdForLocalUnit(args: {
  supabase: ReturnType<typeof getCurrentActingCouncilContext> extends Promise<infer _T> ? any : never
  localUnitId: string
}) {
  const { data, error } = await args.supabase
    .from('local_units')
    .select('legacy_council_id')
    .eq('id', args.localUnitId)
    .maybeSingle<{ legacy_council_id: string | null }>();

  if (error) {
    throw new Error(`Could not load the council link for the active local organization. ${error.message}`);
  }

  const legacyCouncilId = data?.legacy_council_id ?? null;
  if (!legacyCouncilId) {
    throw new Error('The active local organization is missing its linked council id.');
  }

  return legacyCouncilId;
}

export async function createMemberAction(
  _previousState: MemberFormState,
  formData: FormData
): Promise<MemberFormState> {
  const values = collectMemberFormValues(formData);
  const validationError = validateMemberFormValues(values);

  if (validationError) {
    return memberFormErrorState(values, validationError);
  }

  const { supabase, user, localUnitId } = await getCurrentMemberAdminContext();

  if (!localUnitId) {
    return memberFormErrorState(
      values,
      'We could not tell which local organization this member belongs to. Please refresh and try again.'
    );
  }

  let legacyCouncilId: string;
  try {
    legacyCouncilId = await getLegacyCouncilIdForLocalUnit({
      supabase,
      localUnitId,
    });
  } catch (error) {
    return memberFormErrorState(
      values,
      error instanceof Error ? error.message : 'Could not load the linked council for this local organization.'
    );
  }

  const payload = protectPeoplePayload({
    council_id: legacyCouncilId,
    first_name: textValue(formData, 'first_name'),
    middle_name: textValue(formData, 'middle_name'),
    last_name: textValue(formData, 'last_name'),
    email: textValue(formData, 'email'),
    cell_phone: textValue(formData, 'cell_phone'),
    home_phone: textValue(formData, 'home_phone'),
    other_phone: textValue(formData, 'other_phone'),
    address_line_1: textValue(formData, 'address_line_1'),
    address_line_2: textValue(formData, 'address_line_2'),
    city: textValue(formData, 'city'),
    state_province: textValue(formData, 'state_province'),
    postal_code: textValue(formData, 'postal_code'),
    primary_relationship_code: 'member',
    created_source_code: 'admin_manual_member',
    is_provisional_member: true,
    council_activity_level_code: textValue(formData, 'council_activity_level_code'),
    council_activity_context_code: textValue(formData, 'council_activity_context_code'),
    council_reengagement_status_code: textValue(formData, 'council_reengagement_status_code'),
    created_by_auth_user_id: user.id,
    updated_by_auth_user_id: user.id,
  });

  const { data: insertedPerson, error: insertError } = await supabase
    .from('people')
    .insert(payload)
    .select('id')
    .maybeSingle<{ id: string }>();

  if (insertError || !insertedPerson?.id) {
    return memberFormErrorState(
      values,
      friendlyPeopleConstraintMessage(insertError?.message ?? 'We could not save this member right now.')
    );
  }

  const { data: memberRecordId, error: memberRecordError } = await supabase.rpc(
    'ensure_member_record_for_person_local_unit',
    {
      p_local_unit_id: localUnitId,
      p_person_id: insertedPerson.id,
    }
  );

  if (memberRecordError || !memberRecordId) {
    await supabase
      .from('people')
      .delete()
      .eq('id', insertedPerson.id)
      .eq('primary_relationship_code', 'member');

    return memberFormErrorState(
      values,
      `We saved the person record, but could not link this member to the active local organization. ${memberRecordError?.message ?? 'Please try again.'}`
    );
  }

  revalidatePath('/');
  revalidatePath('/members');
  revalidatePath('/members/archive');
  revalidatePath('/custom-lists');
  redirect('/members');
}

export async function updateMemberAction(
  _previousState: MemberFormState,
  formData: FormData
): Promise<MemberFormState> {
  const values = collectMemberFormValues(formData);
  const validationError = validateMemberFormValues(values);

  if (validationError) {
    return memberFormErrorState(values, validationError);
  }

  const memberId = textValue(formData, 'member_id');

  if (!memberId) {
    return memberFormErrorState(values, 'We could not tell which member to save. Please try again.');
  }

  const { supabase, user, localUnitId } = await getCurrentMemberAdminContext();

  const isScopedMember = await ensureActiveLocalUnitMember({
    supabase,
    localUnitId,
    memberId,
  });

  if (!isScopedMember) {
    return memberFormErrorState(values, 'This member is no longer part of the active local organization.');
  }

  const payload = protectPeoplePayload({
    first_name: textValue(formData, 'first_name'),
    middle_name: textValue(formData, 'middle_name'),
    last_name: textValue(formData, 'last_name'),
    email: textValue(formData, 'email'),
    cell_phone: textValue(formData, 'cell_phone'),
    home_phone: textValue(formData, 'home_phone'),
    other_phone: textValue(formData, 'other_phone'),
    address_line_1: textValue(formData, 'address_line_1'),
    address_line_2: textValue(formData, 'address_line_2'),
    city: textValue(formData, 'city'),
    state_province: textValue(formData, 'state_province'),
    postal_code: textValue(formData, 'postal_code'),
    council_activity_level_code: textValue(formData, 'council_activity_level_code'),
    council_activity_context_code: textValue(formData, 'council_activity_context_code'),
    council_reengagement_status_code: textValue(formData, 'council_reengagement_status_code'),
    updated_by_auth_user_id: user.id,
  });

  const { error } = await supabase
    .from('people')
    .update(payload)
    .eq('id', memberId)
    .eq('primary_relationship_code', 'member');

  if (error) {
    return memberFormErrorState(values, friendlyPeopleConstraintMessage(error.message));
  }

  revalidatePath('/');
  revalidatePath('/members');
  revalidatePath(`/members/${memberId}`);
  redirect(`/members/${memberId}`);
}

export async function deleteMemberAction(
  _previousState: DeleteMemberState,
  formData: FormData
): Promise<DeleteMemberState> {
  const memberId = formData.get('member_id');
  const confirmation = formData.get('confirmation');

  if (typeof memberId !== 'string' || !memberId) {
    return { error: 'We could not tell which member to remove.' };
  }

  if (typeof confirmation !== 'string' || confirmation.trim().toUpperCase() !== 'DELETE') {
    return { error: 'Type DELETE to confirm removing this member from the directory.' };
  }

  const { supabase, user, localUnitId } = await getCurrentMemberAdminContext();

  const isScopedMember = await ensureActiveLocalUnitMember({
    supabase,
    localUnitId,
    memberId,
  });

  if (!isScopedMember) {
    return { error: 'This member is no longer part of the active local organization.' };
  }

  const { error: archiveError } = await supabase
    .from('people')
    .update({
      archived_at: new Date().toISOString(),
      archived_by_auth_user_id: user.id,
      updated_by_auth_user_id: user.id,
    })
    .eq('id', memberId)
    .eq('primary_relationship_code', 'member')
    .is('archived_at', null);

  if (archiveError) {
    return { error: `We could not remove this member right now. ${friendlyPeopleConstraintMessage(archiveError.message)}` };
  }

  revalidatePath('/');
  revalidatePath('/members');
  revalidatePath('/members/archive');
  redirect('/members');
}
