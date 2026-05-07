'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { createAdminClient } from '@/lib/supabase/admin';
import { listValidDirectoryPersonIdsForLocalUnit, resolveLegacyCouncilIdForLocalUnit } from '@/lib/custom-lists';
import { isValidEmailAddress } from '@/lib/security/contact-validation';
import { protectPeoplePayload } from '@/lib/security/pii';
import type { DeleteMemberState, MemberFormState, MemberFormValues } from './form-state';

type RelationshipCode = 'member' | 'volunteer_only' | 'prospect';

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

function normalizeRelationshipCode(value: string | null | undefined): RelationshipCode {
  if (value === 'volunteer_only' || value === 'prospect') {
    return value;
  }

  return 'member';
}

function createdSourceCodeForRelationship(relationshipCode: RelationshipCode) {
  if (relationshipCode === 'prospect') {
    return 'scoped_manual_prospect'
  }

  if (relationshipCode === 'volunteer_only') {
    return 'scoped_manual_volunteer'
  }

  return 'admin_manual_member'
}

function collectMemberFormValues(formData: FormData): MemberFormValues {
  return {
    member_id: rawTextValue(formData, 'member_id'),
    primary_relationship_code: normalizeRelationshipCode(rawTextValue(formData, 'primary_relationship_code')),
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
    return 'Enter a valid email address before saving this person.';
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
    return 'We could not save this person because the local database is still missing one setup permission.';
  }

  return message;
}

async function getCurrentMemberAdminContext() {
  const { admin: supabase, permissions, council, localUnitId } = await getCurrentActingCouncilContext({
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
    council,
    localUnitId,
  };
}

async function ensureActiveLocalUnitPerson(args: {
  supabase: ReturnType<typeof createAdminClient>
  localUnitId: string | null
  personId: string
}) {
  if (!args.localUnitId) {
    return false;
  }

  const validPersonIds = await listValidDirectoryPersonIdsForLocalUnit({
    admin: args.supabase,
    localUnitId: args.localUnitId,
    personIds: [args.personId],
  });

  return validPersonIds.includes(args.personId);
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
      'We could not tell which local organization this person belongs to. Please refresh and try again.'
    );
  }

  const linkedCouncilId = await resolveLegacyCouncilIdForLocalUnit({
    admin: supabase,
    localUnitId,
  }).catch(() => null);

  if (!linkedCouncilId) {
    return memberFormErrorState(
      values,
      'This local organization is missing its council bridge, so we could not save this person yet.'
    );
  }

  const relationshipCode = normalizeRelationshipCode(values.primary_relationship_code);

  const payload = protectPeoplePayload({
    council_id: linkedCouncilId,
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
    primary_relationship_code: relationshipCode,
    created_source_code: createdSourceCodeForRelationship(relationshipCode),
    is_provisional_member: relationshipCode === 'member',
    prospect_status_code: relationshipCode === 'prospect' ? 'new' : null,
    volunteer_context_code: relationshipCode === 'volunteer_only' ? 'unknown' : null,
    council_activity_level_code: relationshipCode === 'member' ? textValue(formData, 'council_activity_level_code') : null,
    council_activity_context_code: relationshipCode === 'member' ? textValue(formData, 'council_activity_context_code') : null,
    council_reengagement_status_code: relationshipCode === 'member' ? textValue(formData, 'council_reengagement_status_code') : null,
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
      friendlyPeopleConstraintMessage(insertError?.message ?? 'We could not save this person right now.')
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
      .eq('council_id', linkedCouncilId)
      .eq('primary_relationship_code', relationshipCode);

    return memberFormErrorState(
      values,
      `We saved the person record, but could not link this person to the active local organization. ${memberRecordError?.message ?? 'Please try again.'}`
    );
  }

  revalidatePath('/');
  revalidatePath('/members');
  revalidatePath('/members/archive');
  revalidatePath('/custom-lists');
  redirect(`/members/${insertedPerson.id}`);
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

  const personId = textValue(formData, 'member_id');

  if (!personId) {
    return memberFormErrorState(values, 'We could not tell which person to save. Please try again.');
  }

  const { supabase, user, localUnitId } = await getCurrentMemberAdminContext();

  const isScopedPerson = await ensureActiveLocalUnitPerson({
    supabase,
    localUnitId,
    personId,
  });

  if (!isScopedPerson) {
    return memberFormErrorState(values, 'This person is no longer part of the active local organization.');
  }

  const relationshipCode = normalizeRelationshipCode(values.primary_relationship_code)

  const payload = protectPeoplePayload({
    primary_relationship_code: relationshipCode,
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
    is_provisional_member: relationshipCode === 'member',
    prospect_status_code: relationshipCode === 'prospect' ? 'new' : null,
    volunteer_context_code: relationshipCode === 'volunteer_only' ? 'unknown' : null,
    council_activity_level_code: relationshipCode === 'member' ? textValue(formData, 'council_activity_level_code') : null,
    council_activity_context_code: relationshipCode === 'member' ? textValue(formData, 'council_activity_context_code') : null,
    council_reengagement_status_code: relationshipCode === 'member' ? textValue(formData, 'council_reengagement_status_code') : null,
    updated_by_auth_user_id: user.id,
  });

  const { error } = await supabase
    .from('people')
    .update(payload)
    .eq('id', personId)
    .is('archived_at', null);

  if (error) {
    return memberFormErrorState(values, friendlyPeopleConstraintMessage(error.message));
  }

  revalidatePath('/');
  revalidatePath('/members');
  revalidatePath(`/members/${personId}`);
  redirect(`/members/${personId}`);
}


export async function restoreMemberAction(formData: FormData) {
  const personId = formData.get('member_id')

  if (typeof personId !== 'string' || !personId) {
    redirect('/members/archive?error=We%20could%20not%20tell%20which%20person%20to%20restore.')
  }

  const { supabase, user, localUnitId } = await getCurrentMemberAdminContext()

  if (!localUnitId) {
    redirect('/members/archive?error=We%20could%20not%20tell%20which%20local%20organization%20is%20active.')
  }

  const { error } = await supabase.rpc('restore_local_unit_member_record', {
    p_local_unit_id: localUnitId,
    p_person_id: personId,
    p_actor_user_id: user.id,
  })

  if (error) {
    redirect(
      `/members/archive?error=${encodeURIComponent(
        `We could not restore this person to the active local organization. ${friendlyPeopleConstraintMessage(error.message)}`
      )}`
    )
  }

  revalidatePath('/')
  revalidatePath('/members')
  revalidatePath('/members/archive')
  redirect('/members')
}

export async function deleteMemberAction(
  _previousState: DeleteMemberState,
  formData: FormData
): Promise<DeleteMemberState> {
  const personId = formData.get('member_id');
  const confirmation = formData.get('confirmation');

  if (typeof personId !== 'string' || !personId) {
    return { error: 'We could not tell which person to remove.' };
  }

  if (typeof confirmation !== 'string' || confirmation.trim().toUpperCase() !== 'DELETE') {
    return { error: 'Type DELETE to confirm removing this person from the active local organization directory.' };
  }

  const { supabase, user, localUnitId } = await getCurrentMemberAdminContext();

  const isScopedPerson = await ensureActiveLocalUnitPerson({
    supabase,
    localUnitId,
    personId,
  });

  if (!isScopedPerson) {
    return { error: 'This person is no longer part of the active local organization.' };
  }

  const { error: archiveError } = await supabase.rpc(
    'archive_local_unit_member_record',
    {
      p_local_unit_id: localUnitId,
      p_person_id: personId,
      p_actor_user_id: user.id,
      p_reason: 'Removed from active local organization directory',
    }
  );

  if (archiveError) {
    return {
      error: `We could not remove this person from the active local organization right now. ${friendlyPeopleConstraintMessage(archiveError.message)}`,
    };
  }

  revalidatePath('/');
  revalidatePath('/members');
  revalidatePath('/members/archive');
  redirect('/members');
}
