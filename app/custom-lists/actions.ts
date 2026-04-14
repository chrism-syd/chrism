'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { getSelectedOperationsLocalUnitId, OPERATIONS_SCOPE_COOKIE } from '@/lib/auth/operations-scope-selection'
import {
  canManageCustomList,
  canViewCustomList,
  hasStrictCustomListLifecycleAccess,
  listManageableLocalUnitIdsForCustomLists,
  listValidDirectoryPersonIdsForLocalUnit,
  normalizeEmail,
  resolveCustomListLocalUnitId,
  resolveLegacyCouncilIdForLocalUnit,
  type CustomListRow,
} from '@/lib/custom-lists'
import { decryptPeopleRecords } from '@/lib/security/pii'

export type CreateCustomListState = {
  error: string | null
}

async function loadCustomListForAction(customListId: string) {
  const admin = createAdminClient()
  const permissions = await getCurrentUserPermissions()

  if (!permissions.authUser) {
    redirect('/login')
  }

  const { data, error } = await admin
    .from('custom_lists')
    .select('id, council_id, local_unit_id, name, description, archived_at, created_at, updated_at, created_by_auth_user_id, updated_by_auth_user_id')
    .eq('id', customListId)
    .maybeSingle<CustomListRow>()

  if (error || !data || data.archived_at) {
    redirect('/custom-lists')
  }

  const canView = await canViewCustomList({ admin, permissions, list: data })
  if (!canView) {
    redirect('/me')
  }

  return {
    admin,
    permissions,
    list: data,
    canManage: await canManageCustomList(permissions, data, admin),
  }
}

async function loadCustomListForLifecycleAction(args: {
  customListId: string
  requireArchived?: boolean
}) {
  const admin = createAdminClient()
  const permissions = await getCurrentUserPermissions()

  if (!permissions.authUser) {
    redirect('/login')
  }

  const { data, error } = await admin
    .from('custom_lists')
    .select('id, council_id, local_unit_id, name, description, archived_at, created_at, updated_at, created_by_auth_user_id, updated_by_auth_user_id')
    .eq('id', args.customListId)
    .maybeSingle<CustomListRow>()

  if (error || !data) {
    redirect(args.requireArchived ? '/custom-lists/archive' : '/custom-lists')
  }

  const isArchived = Boolean(data.archived_at)
  if (args.requireArchived ? !isArchived : isArchived) {
    redirect(args.requireArchived ? `/custom-lists/${args.customListId}` : '/custom-lists/archive')
  }

  const hasLifecycleAccess = await hasStrictCustomListLifecycleAccess({
    admin,
    permissions,
    list: data,
  })

  if (!hasLifecycleAccess) {
    redirect('/me')
  }

  const localUnitId = await resolveCustomListLocalUnitId({ admin, list: data })
  if (!localUnitId) {
    throw new Error('This custom list is missing a local unit link, so we could not complete that lifecycle action.')
  }

  return {
    admin,
    permissions,
    list: data,
    localUnitId,
  }
}

async function resolveSelectedManageableCustomListLocalUnitId(args: {
  admin: ReturnType<typeof createAdminClient>
  permissions: Awaited<ReturnType<typeof getCurrentUserPermissions>>
}) {
  if (
    args.permissions.isSuperAdmin &&
    args.permissions.actingMode === 'admin' &&
    args.permissions.activeLocalUnitId
  ) {
    return args.permissions.activeLocalUnitId
  }

  const manageableLocalUnitIds = await listManageableLocalUnitIdsForCustomLists({
    admin: args.admin,
    permissions: args.permissions,
  })

  if (manageableLocalUnitIds.length === 0) {
    return null
  }

  const cookieStore = await cookies()
  const selectedLocalUnitId = getSelectedOperationsLocalUnitId({
    rawCookieValue: cookieStore.get(OPERATIONS_SCOPE_COOKIE)?.value ?? null,
  })

  if (selectedLocalUnitId && manageableLocalUnitIds.includes(selectedLocalUnitId)) {
    return selectedLocalUnitId
  }

  if (args.permissions.activeLocalUnitId && manageableLocalUnitIds.includes(args.permissions.activeLocalUnitId)) {
    return args.permissions.activeLocalUnitId
  }

  return manageableLocalUnitIds.length === 1 ? manageableLocalUnitIds[0] : null
}

export async function createCustomListFromMembersAction(
  _previousState: CreateCustomListState,
  formData: FormData
): Promise<CreateCustomListState> {
  const name = String(formData.get('name') ?? '').trim()
  const descriptionValue = String(formData.get('description') ?? '').trim()
  const selectedMemberIds = String(formData.get('member_ids') ?? '[]')

  if (!name) {
    return { error: 'Give this custom list a name before saving it.' }
  }

  let parsedIds: string[] = []
  try {
    const decoded = JSON.parse(selectedMemberIds)
    parsedIds = Array.isArray(decoded) ? decoded.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return { error: 'We could not read the members in this filtered view. Please try again.' }
  }

  const memberIds = [...new Set(parsedIds)]
  if (memberIds.length === 0) {
    return { error: 'There are no members in this filtered view to save into a custom list.' }
  }

  const admin = createAdminClient()
  const permissions = await getCurrentUserPermissions()

  if (!permissions.authUser) {
    redirect('/login')
  }

  if (!permissions.canManageCustomLists) {
    return { error: 'You do not have permission to create custom lists here.' }
  }

  const localUnitId = await resolveSelectedManageableCustomListLocalUnitId({
    admin,
    permissions,
  })

  if (!localUnitId) {
    return { error: 'Choose a local organization before creating a custom list.' }
  }

  const legacyCouncilId = await resolveLegacyCouncilIdForLocalUnit({
    admin,
    localUnitId,
  })

  if (!legacyCouncilId) {
    return { error: 'This local organization is missing its required council bridge for custom list writes.' }
  }

  const authUserId = permissions.authUser.id

  let scopedMemberIds: string[] = []
  try {
    scopedMemberIds = await listValidDirectoryPersonIdsForLocalUnit({
      admin,
      localUnitId,
      personIds: memberIds,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Please try again.'
    return { error: `Could not load the people for this list. ${message}` }
  }

  if (scopedMemberIds.length === 0) {
    return { error: 'The selected people are no longer available in the active directory.' }
  }

  const { data: customListData, error: createError } = await admin
    .from('custom_lists')
    .insert({
      council_id: legacyCouncilId,
      local_unit_id: localUnitId,
      name,
      description: descriptionValue || null,
      created_by_auth_user_id: authUserId,
      updated_by_auth_user_id: authUserId,
    })
    .select('id')
    .maybeSingle<{ id: string }>()

  if (createError || !customListData?.id) {
    return { error: `Could not create this custom list. ${createError?.message ?? 'Please try again.'}` }
  }

  const { error: memberInsertError } = await admin.from('custom_list_members').insert(
    scopedMemberIds.map((personId) => ({
      custom_list_id: customListData.id,
      person_id: personId,
      added_by_auth_user_id: authUserId,
    }))
  )

  if (memberInsertError) {
    return { error: `The custom list was created, but we could not add the people. ${memberInsertError.message}` }
  }

  revalidatePath('/members')
  revalidatePath('/custom-lists')
  redirect(`/custom-lists/${customListData.id}`)
}

export async function updateCustomListDetailsAction(formData: FormData) {
  const customListId = String(formData.get('custom_list_id') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const descriptionValue = String(formData.get('description') ?? '').trim()

  if (!customListId) {
    redirect('/custom-lists')
  }

  if (!name) {
    throw new Error('Give this custom list a name before saving it.')
  }

  const { admin, permissions, list } = await loadCustomListForLifecycleAction({
    customListId,
    requireArchived: false,
  })

  const userId = permissions.authUser?.id
  if (!userId) {
    redirect('/login')
  }

  const { error } = await admin
    .from('custom_lists')
    .update({
      name,
      description: descriptionValue || null,
      updated_at: new Date().toISOString(),
      updated_by_auth_user_id: userId,
    })
    .eq('id', list.id)

  if (error) {
    throw new Error(`Could not update this custom list. ${error.message}`)
  }

  revalidatePath('/custom-lists')
  revalidatePath(`/custom-lists/${customListId}`)
  revalidatePath(`/custom-lists/${customListId}/edit`)
  redirect(`/custom-lists/${customListId}`)
}

export async function archiveCustomListAction(formData: FormData) {
  const customListId = String(formData.get('custom_list_id') ?? '')

  if (!customListId) {
    redirect('/custom-lists')
  }

  const { admin, permissions, list } = await loadCustomListForLifecycleAction({
    customListId,
    requireArchived: false,
  })

  const userId = permissions.authUser?.id
  if (!userId) {
    redirect('/login')
  }

  const now = new Date().toISOString()
  const { error } = await admin
    .from('custom_lists')
    .update({
      archived_at: now,
      archived_by_auth_user_id: userId,
      updated_at: now,
      updated_by_auth_user_id: userId,
    })
    .eq('id', list.id)

  if (error) {
    throw new Error(`Could not archive this custom list. ${error.message}`)
  }

  revalidatePath('/custom-lists')
  revalidatePath('/custom-lists/archive')
  revalidatePath(`/custom-lists/${customListId}`)
  redirect('/custom-lists/archive')
}

export async function restoreCustomListAction(formData: FormData) {
  const customListId = String(formData.get('custom_list_id') ?? '')

  if (!customListId) {
    redirect('/custom-lists/archive')
  }

  const { admin, permissions, list } = await loadCustomListForLifecycleAction({
    customListId,
    requireArchived: true,
  })

  const userId = permissions.authUser?.id
  if (!userId) {
    redirect('/login')
  }

  const now = new Date().toISOString()
  const { error } = await admin
    .from('custom_lists')
    .update({
      archived_at: null,
      archived_by_auth_user_id: null,
      updated_at: now,
      updated_by_auth_user_id: userId,
    })
    .eq('id', list.id)

  if (error) {
    throw new Error(`Could not restore this custom list. ${error.message}`)
  }

  revalidatePath('/custom-lists')
  revalidatePath('/custom-lists/archive')
  revalidatePath(`/custom-lists/${customListId}`)
  redirect(`/custom-lists/${customListId}`)
}

export async function deleteCustomListAction(formData: FormData) {
  const customListId = String(formData.get('custom_list_id') ?? '')

  if (!customListId) {
    redirect('/custom-lists/archive')
  }

  const { admin, permissions, list } = await loadCustomListForLifecycleAction({
    customListId,
    requireArchived: true,
  })

  const userId = permissions.authUser?.id
  if (!userId) {
    redirect('/login')
  }

  const { error } = await admin
    .from('custom_lists')
    .delete()
    .eq('id', list.id)

  if (error) {
    throw new Error(`Could not permanently delete this custom list. ${error.message}`)
  }

  revalidatePath('/custom-lists')
  revalidatePath('/custom-lists/archive')
  revalidatePath(`/custom-lists/${customListId}`)
  redirect('/custom-lists/archive')
}

export async function shareCustomListAction(formData: FormData) {
  const customListId = String(formData.get('custom_list_id') ?? '')
  const singlePersonId = String(formData.get('person_id') ?? '').trim()
  const personIds = [
    ...formData.getAll('person_ids').filter((value): value is string => typeof value === 'string'),
    ...(singlePersonId ? [singlePersonId] : []),
  ]

  if (!customListId || personIds.length === 0) {
    redirect(customListId ? `/custom-lists/${customListId}` : '/custom-lists')
  }

  const { admin, permissions, list, canManage } = await loadCustomListForAction(customListId)
  if (!canManage) {
    redirect(`/custom-lists/${customListId}`)
  }

  const localUnitId = await resolveCustomListLocalUnitId({ admin, list })
  if (!localUnitId) {
    throw new Error('This custom list is missing its local organization link.')
  }

  const uniquePersonIds = [...new Set(personIds)]
  const scopedPersonIds = await listValidDirectoryPersonIdsForLocalUnit({
    admin,
    localUnitId,
    personIds: uniquePersonIds,
  })

  const [{ data: peopleRows, error: peopleError }, { data: linkedUserRows, error: linkedUserError }] = await Promise.all([
    admin
      .from('people')
      .select('id, email')
      .in('id', scopedPersonIds)
      .is('archived_at', null),
    scopedPersonIds.length > 0
      ? admin
          .from('users')
          .select('id, person_id')
          .in('person_id', scopedPersonIds)
      : Promise.resolve({ data: [] as Array<{ id: string; person_id: string | null }>, error: null }),
  ])

  if (peopleError) {
    throw new Error(`Could not load people to share with. ${peopleError.message}`)
  }

  if (linkedUserError) {
    throw new Error(`Could not load linked user accounts for sharing. ${linkedUserError.message}`)
  }

  const linkedUserIdByPersonId = new Map<string, string>()
  for (const row of ((linkedUserRows as Array<{ id: string; person_id: string | null }> | null) ?? [])) {
    if (row.person_id) {
      linkedUserIdByPersonId.set(row.person_id, row.id)
    }
  }

  const payload = decryptPeopleRecords((peopleRows as Array<{ id: string; email: string | null }> | null) ?? []).map((person) => ({
    custom_list_id: customListId,
    person_id: person.id,
    user_id: linkedUserIdByPersonId.get(person.id) ?? null,
    grantee_email: normalizeEmail(person.email),
    granted_by_auth_user_id: permissions.authUser?.id ?? null,
  }))

  if (payload.length === 0) {
    throw new Error('We could not find those people in the active directory for this local organization.')
  }

  const targetUserIds = [
    ...new Set(payload.map((row) => row.user_id).filter((value): value is string => Boolean(value))),
  ]

  for (const targetUserId of targetUserIds) {
    const { error: grantError } = await admin.rpc('grant_parallel_custom_list_access_to_user', {
      p_actor_user_id: permissions.authUser?.id ?? null,
      p_target_user_id: targetUserId,
      p_custom_list_id: customListId,
      p_access_level: 'interact',
      p_source_code: 'manual',
    })

    if (grantError) {
      throw new Error(`Could not grant custom list access right now. ${grantError.message}`)
    }
  }

  const { error } = await admin
    .from('custom_list_access')
    .upsert(payload, { onConflict: 'custom_list_id,person_id' })

  if (error) {
    throw new Error(`Could not save this custom list share. ${error.message}`)
  }

  revalidatePath('/custom-lists')
  revalidatePath(`/custom-lists/${customListId}`)
  redirect(`/custom-lists/${customListId}`)
}

export async function revokeCustomListAccessAction(formData: FormData) {
  const customListId = String(formData.get('custom_list_id') ?? '')
  const accessId = String(formData.get('access_id') ?? '')

  if (!customListId || !accessId) {
    redirect('/custom-lists')
  }

  const { admin, permissions, canManage } = await loadCustomListForAction(customListId)
  if (!canManage) {
    redirect(`/custom-lists/${customListId}`)
  }

  const { data: liveShareRow, error: liveShareError } = await admin
    .from('v_effective_resource_access')
    .select('resource_access_grant_id, person_id, user_id')
    .eq('resource_access_grant_id', accessId)
    .eq('resource_type', 'custom_list')
    .eq('resource_key', customListId)
    .eq('is_effective', true)
    .maybeSingle<{ resource_access_grant_id: string; person_id: string | null; user_id: string | null }>()

  if (liveShareError) {
    throw new Error(`Could not load the live custom list share. ${liveShareError.message}`)
  }

  const { data: legacyAccessRow, error: legacyAccessError } = await admin
    .from('custom_list_access')
    .select('id, person_id, user_id, grantee_email')
    .eq('id', accessId)
    .eq('custom_list_id', customListId)
    .maybeSingle<{ id: string; person_id: string | null; user_id: string | null; grantee_email: string | null }>()

  if (legacyAccessError) {
    throw new Error(`Could not load the compatibility share row. ${legacyAccessError.message}`)
  }

  const resolvedPersonIds = new Set<string>()
  const targetUserIds = new Set<string>()

  if (liveShareRow?.person_id) {
    resolvedPersonIds.add(liveShareRow.person_id)
  }
  if (legacyAccessRow?.person_id) {
    resolvedPersonIds.add(legacyAccessRow.person_id)
  }

  if (liveShareRow?.user_id) {
    targetUserIds.add(liveShareRow.user_id)
  }
  if (legacyAccessRow?.user_id) {
    targetUserIds.add(legacyAccessRow.user_id)
  }

  if (resolvedPersonIds.size > 0) {
    const { data: linkedUsers, error: linkedUsersError } = await admin
      .from('users')
      .select('id, person_id')
      .in('person_id', [...resolvedPersonIds])

    if (linkedUsersError) {
      throw new Error(`Could not load linked user accounts for this share. ${linkedUsersError.message}`)
    }

    for (const row of ((linkedUsers as Array<{ id: string | null; person_id: string | null }> | null) ?? [])) {
      if (row.id) {
        targetUserIds.add(row.id)
      }
      if (row.person_id) {
        resolvedPersonIds.add(row.person_id)
      }
    }
  }

  if (resolvedPersonIds.size > 0) {
    const { error: releaseClaimError } = await admin
      .from('custom_list_members')
      .update({
        claimed_by_person_id: null,
        claimed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('custom_list_id', customListId)
      .in('claimed_by_person_id', [...resolvedPersonIds])

    if (releaseClaimError) {
      throw new Error(`Could not release claims for this removed share. ${releaseClaimError.message}`)
    }
  }

  for (const targetUserId of targetUserIds) {
    const { error: revokeError } = await admin.rpc('revoke_parallel_custom_list_access_from_user', {
      p_actor_user_id: permissions.authUser?.id ?? null,
      p_target_user_id: targetUserId,
      p_custom_list_id: customListId,
      p_source_code: 'manual',
    })

    if (revokeError) {
      throw new Error(`Could not revoke custom list access right now. ${revokeError.message}`)
    }
  }

  let deleteLegacyError: string | null = null

  if (resolvedPersonIds.size > 0) {
    const { error } = await admin
      .from('custom_list_access')
      .delete()
      .eq('custom_list_id', customListId)
      .in('person_id', [...resolvedPersonIds])

    if (error) {
      deleteLegacyError = error.message
    }
  }

  if (targetUserIds.size > 0 && !deleteLegacyError) {
    const { error } = await admin
      .from('custom_list_access')
      .delete()
      .eq('custom_list_id', customListId)
      .in('user_id', [...targetUserIds])

    if (error) {
      deleteLegacyError = error.message
    }
  }

  if (!deleteLegacyError && legacyAccessRow?.id) {
    const { error } = await admin
      .from('custom_list_access')
      .delete()
      .eq('id', legacyAccessRow.id)
      .eq('custom_list_id', customListId)

    if (error) {
      deleteLegacyError = error.message
    }
  }

  if (deleteLegacyError) {
    throw new Error(`Could not clean up the compatibility share row. ${deleteLegacyError}`)
  }

  revalidatePath('/custom-lists')
  revalidatePath(`/custom-lists/${customListId}`)
  redirect(`/custom-lists/${customListId}`)
}

export async function claimCustomListMemberAction(formData: FormData) {
  const customListId = String(formData.get('custom_list_id') ?? '')
  const customListMemberId = String(formData.get('custom_list_member_id') ?? '')

  if (!customListId || !customListMemberId) {
    redirect('/custom-lists')
  }

  const { admin, permissions, canManage } = await loadCustomListForAction(customListId)
  if (!permissions.personId) {
    throw new Error('Link your profile before claiming members on a custom list.')
  }

  const { data: memberRow, error: memberError } = await admin
    .from('custom_list_members')
    .select('id, claimed_by_person_id')
    .eq('id', customListMemberId)
    .eq('custom_list_id', customListId)
    .maybeSingle<{ id: string; claimed_by_person_id: string | null }>()

  if (memberError || !memberRow) {
    throw new Error('We could not find that list member.')
  }

  if (memberRow.claimed_by_person_id && memberRow.claimed_by_person_id !== permissions.personId) {
    throw new Error('This member has already been claimed by someone else on the list.')
  }

  const now = new Date().toISOString()
  const { error } = await admin
    .from('custom_list_members')
    .update({
      claimed_by_person_id: permissions.personId,
      claimed_at: now,
      updated_at: now,
    })
    .eq('id', customListMemberId)
    .eq('custom_list_id', customListId)

  if (error) {
    throw new Error(`Could not claim this member right now. ${error.message}`)
  }

  revalidatePath('/custom-lists')
  revalidatePath(`/custom-lists/${customListId}`)
  if (canManage) {
    revalidatePath('/members')
  }
  redirect(`/custom-lists/${customListId}`)
}

export async function releaseCustomListClaimAction(formData: FormData) {
  const customListId = String(formData.get('custom_list_id') ?? '')
  const customListMemberId = String(formData.get('custom_list_member_id') ?? '')

  if (!customListId || !customListMemberId) {
    redirect('/custom-lists')
  }

  const { admin, permissions } = await loadCustomListForAction(customListId)
  if (!permissions.personId) {
    throw new Error('Link your profile before changing list claims.')
  }

  const { data: memberRow, error: memberError } = await admin
    .from('custom_list_members')
    .select('id, claimed_by_person_id')
    .eq('id', customListMemberId)
    .eq('custom_list_id', customListId)
    .maybeSingle<{ id: string; claimed_by_person_id: string | null }>()

  if (memberError || !memberRow) {
    throw new Error('We could not find that list member.')
  }

  if (memberRow.claimed_by_person_id !== permissions.personId) {
    throw new Error('Only the person who claimed this member can release that claim.')
  }

  const now = new Date().toISOString()
  const { error } = await admin
    .from('custom_list_members')
    .update({
      claimed_by_person_id: null,
      claimed_at: null,
      updated_at: now,
    })
    .eq('id', customListMemberId)
    .eq('custom_list_id', customListId)

  if (error) {
    throw new Error(`Could not release this claim right now. ${error.message}`)
  }

  revalidatePath('/custom-lists')
  revalidatePath(`/custom-lists/${customListId}`)
  redirect(`/custom-lists/${customListId}`)
}

function parseContactDateInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return new Date().toISOString()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('Choose a valid contact date before saving.')
  }
  return `${trimmed}T12:00:00.000Z`
}

export async function logCustomListContactAction(formData: FormData) {
  const customListId = String(formData.get('custom_list_id') ?? '')
  const customListMemberId = String(formData.get('custom_list_member_id') ?? '')

  if (!customListId || !customListMemberId) {
    redirect('/custom-lists')
  }

  const { admin, permissions } = await loadCustomListForAction(customListId)
  if (!permissions.personId) {
    throw new Error('Link your profile before logging contact on a custom list.')
  }

  const { data: memberRow, error: memberError } = await admin
    .from('custom_list_members')
    .select('id, claimed_by_person_id')
    .eq('id', customListMemberId)
    .eq('custom_list_id', customListId)
    .maybeSingle<{ id: string; claimed_by_person_id: string | null }>()

  if (memberError || !memberRow) {
    throw new Error('We could not find that list member.')
  }

  if (memberRow.claimed_by_person_id && memberRow.claimed_by_person_id !== permissions.personId) {
    throw new Error('This member is already claimed by someone else on the list.')
  }

  const now = new Date().toISOString()
  const contactDate = parseContactDateInput(String(formData.get('contact_date') ?? ''))
  const payload: {
    claimed_by_person_id: string
    claimed_at?: string
    last_contact_at: string
    last_contact_by_person_id: string
    updated_at: string
  } = {
    claimed_by_person_id: permissions.personId,
    last_contact_at: contactDate,
    last_contact_by_person_id: permissions.personId,
    updated_at: now,
  }

  if (!memberRow.claimed_by_person_id) {
    payload.claimed_at = now
  }

  const { error } = await admin
    .from('custom_list_members')
    .update(payload)
    .eq('id', customListMemberId)
    .eq('custom_list_id', customListId)

  if (error) {
    throw new Error(`Could not log that contact right now. ${error.message}`)
  }

  revalidatePath('/custom-lists')
  revalidatePath(`/custom-lists/${customListId}`)
  revalidatePath('/members')
  redirect(`/custom-lists/${customListId}`)
}

export async function removeCustomListMemberAction(formData: FormData) {
  const customListId = String(formData.get('custom_list_id') ?? '')
  const customListMemberId = String(formData.get('custom_list_member_id') ?? '')

  if (!customListId || !customListMemberId) {
    redirect(customListId ? `/custom-lists/${customListId}` : '/custom-lists')
  }

  const { admin, canManage } = await loadCustomListForAction(customListId)
  if (!canManage) {
    redirect(`/custom-lists/${customListId}`)
  }

  const { error } = await admin
    .from('custom_list_members')
    .delete()
    .eq('id', customListMemberId)
    .eq('custom_list_id', customListId)

  if (error) {
    throw new Error(`Could not remove that member from this custom list. ${error.message}`)
  }

  revalidatePath('/custom-lists')
  revalidatePath(`/custom-lists/${customListId}`)
  revalidatePath('/members')
  redirect(`/custom-lists/${customListId}`)
}

export async function addCustomListMemberAction(formData: FormData) {
  const customListId = String(formData.get('custom_list_id') ?? '')
  const personId = String(formData.get('person_id') ?? '').trim()

  if (!customListId || !personId) {
    redirect(customListId ? `/custom-lists/${customListId}` : '/custom-lists')
  }

  const { admin, permissions, list, canManage } = await loadCustomListForAction(customListId)
  if (!canManage) {
    redirect(`/custom-lists/${customListId}`)
  }

  const localUnitId = await resolveCustomListLocalUnitId({ admin, list })
  if (!localUnitId) {
    throw new Error('This custom list is missing its local organization link.')
  }

  const scopedPersonIds = await listValidDirectoryPersonIdsForLocalUnit({
    admin,
    localUnitId,
    personIds: [personId],
  })

  if (!scopedPersonIds.includes(personId)) {
    throw new Error('We could not find that person in this directory.')
  }

  const { error } = await admin.from('custom_list_members').upsert(
    {
      custom_list_id: customListId,
      person_id: personId,
      added_by_auth_user_id: permissions.authUser?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'custom_list_id,person_id' }
  )

  if (error) {
    throw new Error(`Could not add that person to this custom list. ${error.message}`)
  }

  revalidatePath('/custom-lists')
  revalidatePath(`/custom-lists/${customListId}`)
  revalidatePath('/members')
  redirect(`/custom-lists/${customListId}`)
}
