'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { assertCanManageCustomListsInContext } from '@/lib/auth/area-access'
import {
  buildAccessibleCustomListQuery,
  getCurrentActingLocalUnitId,
} from '@/lib/custom-lists'
import { getCurrentAreaContextCookieValues } from '@/lib/auth/access-contexts'
import {
  parseContactDateValue,
  parseOptionalDateValue,
  parseOptionalIntegerValue,
  protectCustomListMemberInsertPayload,
  protectCustomListMemberUpdatePayload,
} from '@/lib/security/pii'

function normalizeText(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeLabel(value: string | null, fallback: string) {
  return value ?? fallback
}

function countValue(value: string | null) {
  return value ?? '0'
}

async function getAccessibleListOrRedirect(args: {
  admin: ReturnType<typeof createAdminClient>
  permissions: Awaited<ReturnType<typeof getCurrentUserPermissions>>
  listId: string
  redirectTo: string
}) {
  const localUnitId = await getCurrentActingLocalUnitId({
    admin: args.admin,
    permissions: args.permissions,
  })

  if (!localUnitId) {
    redirect(args.redirectTo)
  }

  const query = buildAccessibleCustomListQuery({
    admin: args.admin,
    permissions: args.permissions,
    localUnitId,
  })

  const { data, error } = await query
    .eq('id', args.listId)
    .maybeSingle<{ id: string; name: string; local_unit_id: string | null }>()

  if (error || !data) {
    redirect(args.redirectTo)
  }

  if (!data.local_unit_id) {
    redirect(args.redirectTo)
  }

  return {
    id: data.id,
    name: data.name,
    localUnitId: data.local_unit_id,
  }
}

async function resolveCurrentListContext(args: {
  admin: ReturnType<typeof createAdminClient>
  permissions: Awaited<ReturnType<typeof getCurrentUserPermissions>>
}) {
  const context = await getCurrentActingCouncilContext({
    permissions: args.permissions,
    supabaseAdmin: args.admin,
    requireAdmin: false,
    redirectTo: '/custom-lists',
  })

  const localUnitId = await getCurrentActingLocalUnitId({
    admin: args.admin,
    permissions: args.permissions,
  })

  if (!localUnitId) {
    redirect('/custom-lists')
  }

  await assertCanManageCustomListsInContext({
    admin: args.admin,
    permissions: args.permissions,
    localUnitId,
    redirectTo: '/custom-lists',
  })

  return {
    localUnitId,
    councilId: context.council.id,
  }
}

function sortMemberOptions(options: Array<{ id: string; label: string }>) {
  return [...options].sort((left, right) => left.label.localeCompare(right.label))
}

export async function createCustomListAction(formData: FormData) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const listName = normalizeText(formData.get('name'))
  const listDescription = normalizeText(formData.get('description'))
  const selectedMemberIds = formData.getAll('selected_member_ids').flatMap((value) => {
    if (typeof value !== 'string') return []
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  })

  const { localUnitId, councilId } = await resolveCurrentListContext({ admin, permissions })

  if (!listName) {
    redirect('/custom-lists?error=Enter%20a%20name%20for%20the%20list.')
  }

  const { data: createdList, error: listError } = await admin
    .from('custom_lists')
    .insert({
      name: listName,
      description: listDescription,
      local_unit_id: localUnitId,
      council_id: councilId,
      created_by_auth_user_id: permissions.authUser?.id ?? null,
      updated_by_auth_user_id: permissions.authUser?.id ?? null,
    })
    .select('id')
    .maybeSingle<{ id: string }>()

  if (listError || !createdList?.id) {
    redirect('/custom-lists?error=Could%20not%20create%20the%20list.')
  }

  if (selectedMemberIds.length > 0) {
    const memberRows = selectedMemberIds.map((personId, index) =>
      protectCustomListMemberInsertPayload({
        custom_list_id: createdList.id,
        person_id: personId,
        added_by_auth_user_id: permissions.authUser?.id ?? null,
        added_source_code: 'bulk_selection',
        sort_order: index,
      })
    )

    const { error: membersError } = await admin
      .from('custom_list_members')
      .insert(memberRows)

    if (membersError) {
      redirect(`/custom-lists/${createdList.id}?error=List%20created%2C%20but%20some%20members%20could%20not%20be%20added.`)
    }
  }

  revalidatePath('/custom-lists')
  redirect(`/custom-lists/${createdList.id}`)
}

export async function updateCustomListDetailsAction(formData: FormData) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const listId = normalizeText(formData.get('list_id'))
  const listName = normalizeText(formData.get('name'))
  const listDescription = normalizeText(formData.get('description'))

  if (!listId) {
    redirect('/custom-lists')
  }

  const accessibleList = await getAccessibleListOrRedirect({
    admin,
    permissions,
    listId,
    redirectTo: '/custom-lists',
  })

  await assertCanManageCustomListsInContext({
    admin,
    permissions,
    localUnitId: accessibleList.localUnitId,
    redirectTo: `/custom-lists/${listId}`,
  })

  if (!listName) {
    redirect(`/custom-lists/${listId}?error=Enter%20a%20name%20for%20the%20list.`)
  }

  const { error } = await admin
    .from('custom_lists')
    .update({
      name: listName,
      description: listDescription,
      updated_by_auth_user_id: permissions.authUser?.id ?? null,
    })
    .eq('id', listId)

  if (error) {
    redirect(`/custom-lists/${listId}?error=Could%20not%20save%20the%20list%20details.`)
  }

  revalidatePath(`/custom-lists/${listId}`)
  revalidatePath('/custom-lists')
  redirect(`/custom-lists/${listId}`)
}

export async function addCustomListMemberAction(formData: FormData) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const listId = normalizeText(formData.get('list_id'))
  const personId = normalizeText(formData.get('person_id'))
  const sourceCode = normalizeText(formData.get('added_source_code')) ?? 'manual_add'

  if (!listId) {
    redirect('/custom-lists')
  }

  if (!personId) {
    redirect(`/custom-lists/${listId}?error=Choose%20a%20member%20to%20add.`)
  }

  const accessibleList = await getAccessibleListOrRedirect({
    admin,
    permissions,
    listId,
    redirectTo: '/custom-lists',
  })

  await assertCanManageCustomListsInContext({
    admin,
    permissions,
    localUnitId: accessibleList.localUnitId,
    redirectTo: `/custom-lists/${listId}`,
  })

  const { data: existingRows } = await admin
    .from('custom_list_members')
    .select('sort_order')
    .eq('custom_list_id', listId)

  const nextSortOrder = ((existingRows as Array<{ sort_order: number | null }> | null) ?? [])
    .reduce((highest, row) => Math.max(highest, row.sort_order ?? -1), -1) + 1

  const payload = protectCustomListMemberInsertPayload({
    custom_list_id: listId,
    person_id: personId,
    added_by_auth_user_id: permissions.authUser?.id ?? null,
    added_source_code: sourceCode,
    sort_order: nextSortOrder,
  })

  const { error } = await admin
    .from('custom_list_members')
    .insert(payload)

  if (error) {
    redirect(`/custom-lists/${listId}?error=Could%20not%20add%20that%20member%20to%20the%20list.`)
  }

  revalidatePath(`/custom-lists/${listId}`)
  redirect(`/custom-lists/${listId}`)
}

export async function updateCustomListMemberAction(formData: FormData) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const memberId = normalizeText(formData.get('member_id'))
  const listId = normalizeText(formData.get('list_id'))
  const notes = normalizeText(formData.get('notes'))
  const statusCode = normalizeText(formData.get('status_code'))
  const priorityCode = normalizeText(formData.get('priority_code'))
  const lastContactDate = parseContactDateValue(formData.get('last_contact_date'))
  const followUpOn = parseOptionalDateValue(formData.get('follow_up_on'))
  const contactAttempts = parseOptionalIntegerValue(formData.get('contact_attempt_count'))

  if (!memberId || !listId) {
    redirect('/custom-lists')
  }

  const accessibleList = await getAccessibleListOrRedirect({
    admin,
    permissions,
    listId,
    redirectTo: '/custom-lists',
  })

  await assertCanManageCustomListsInContext({
    admin,
    permissions,
    localUnitId: accessibleList.localUnitId,
    redirectTo: `/custom-lists/${listId}`,
  })

  const payload = protectCustomListMemberUpdatePayload({
    notes,
    status_code: statusCode,
    priority_code: priorityCode,
    last_contact_date: lastContactDate,
    follow_up_on: followUpOn,
    contact_attempt_count: contactAttempts,
    updated_at: new Date().toISOString(),
  })

  const { error } = await admin
    .from('custom_list_members')
    .update(payload)
    .eq('id', memberId)
    .eq('custom_list_id', listId)

  if (error) {
    redirect(`/custom-lists/${listId}?error=Could%20not%20save%20that%20entry.`)
  }

  revalidatePath(`/custom-lists/${listId}`)
  redirect(`/custom-lists/${listId}`)
}

export async function removeCustomListMemberAction(formData: FormData) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const memberId = normalizeText(formData.get('member_id'))
  const listId = normalizeText(formData.get('list_id'))

  if (!memberId || !listId) {
    redirect('/custom-lists')
  }

  const accessibleList = await getAccessibleListOrRedirect({
    admin,
    permissions,
    listId,
    redirectTo: '/custom-lists',
  })

  await assertCanManageCustomListsInContext({
    admin,
    permissions,
    localUnitId: accessibleList.localUnitId,
    redirectTo: `/custom-lists/${listId}`,
  })

  const { error } = await admin
    .from('custom_list_members')
    .delete()
    .eq('id', memberId)
    .eq('custom_list_id', listId)

  if (error) {
    redirect(`/custom-lists/${listId}?error=Could%20not%20remove%20that%20member.`)
  }

  revalidatePath(`/custom-lists/${listId}`)
  redirect(`/custom-lists/${listId}`)
}

export async function duplicateCustomListAction(formData: FormData) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const listId = normalizeText(formData.get('list_id'))

  if (!listId) {
    redirect('/custom-lists')
  }

  const accessibleList = await getAccessibleListOrRedirect({
    admin,
    permissions,
    listId,
    redirectTo: '/custom-lists',
  })

  await assertCanManageCustomListsInContext({
    admin,
    permissions,
    localUnitId: accessibleList.localUnitId,
    redirectTo: `/custom-lists/${listId}`,
  })

  const { data: listRow } = await admin
    .from('custom_lists')
    .select('name, description, council_id, local_unit_id')
    .eq('id', listId)
    .maybeSingle<{ name: string; description: string | null; council_id: string | null; local_unit_id: string | null }>()

  if (!listRow?.local_unit_id) {
    redirect(`/custom-lists/${listId}?error=Could%20not%20duplicate%20that%20list.`)
  }

  const { data: createdList, error: createError } = await admin
    .from('custom_lists')
    .insert({
      name: `${listRow.name} copy`,
      description: listRow.description,
      council_id: listRow.council_id,
      local_unit_id: listRow.local_unit_id,
      created_by_auth_user_id: permissions.authUser?.id ?? null,
      updated_by_auth_user_id: permissions.authUser?.id ?? null,
    })
    .select('id')
    .maybeSingle<{ id: string }>()

  if (createError || !createdList?.id) {
    redirect(`/custom-lists/${listId}?error=Could%20not%20duplicate%20that%20list.`)
  }

  const { data: existingMembers } = await admin
    .from('custom_list_members')
    .select('*')
    .eq('custom_list_id', listId)
    .order('sort_order', { ascending: true })

  const rows = (existingMembers as Array<Record<string, unknown>> | null) ?? []
  if (rows.length > 0) {
    const duplicatedRows = rows.map((row) => {
      const payload = { ...row }
      delete payload.id
      payload.custom_list_id = createdList.id
      payload.added_by_auth_user_id = permissions.authUser?.id ?? null
      return payload
    })

    const { error: memberCopyError } = await admin
      .from('custom_list_members')
      .insert(duplicatedRows)

    if (memberCopyError) {
      redirect(`/custom-lists/${createdList.id}?error=The%20list%20was%20copied%2C%20but%20some%20members%20could%20not%20be%20duplicated.`)
    }
  }

  revalidatePath('/custom-lists')
  redirect(`/custom-lists/${createdList.id}`)
}

export async function archiveCustomListAction(formData: FormData) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const listId = normalizeText(formData.get('list_id'))

  if (!listId) {
    redirect('/custom-lists')
  }

  const accessibleList = await getAccessibleListOrRedirect({
    admin,
    permissions,
    listId,
    redirectTo: '/custom-lists',
  })

  await assertCanManageCustomListsInContext({
    admin,
    permissions,
    localUnitId: accessibleList.localUnitId,
    redirectTo: `/custom-lists/${listId}`,
  })

  const { error } = await admin
    .from('custom_lists')
    .update({
      archived_at: new Date().toISOString(),
      archived_by_auth_user_id: permissions.authUser?.id ?? null,
      updated_by_auth_user_id: permissions.authUser?.id ?? null,
    })
    .eq('id', listId)

  if (error) {
    redirect(`/custom-lists/${listId}?error=Could%20not%20archive%20that%20list.`)
  }

  revalidatePath('/custom-lists')
  redirect('/custom-lists')
}

export async function unarchiveCustomListAction(formData: FormData) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const listId = normalizeText(formData.get('list_id'))

  if (!listId) {
    redirect('/custom-lists')
  }

  const accessibleList = await getAccessibleListOrRedirect({
    admin,
    permissions,
    listId,
    redirectTo: '/custom-lists',
  })

  await assertCanManageCustomListsInContext({
    admin,
    permissions,
    localUnitId: accessibleList.localUnitId,
    redirectTo: `/custom-lists/${listId}`,
  })

  const { error } = await admin
    .from('custom_lists')
    .update({
      archived_at: null,
      archived_by_auth_user_id: null,
      updated_by_auth_user_id: permissions.authUser?.id ?? null,
    })
    .eq('id', listId)

  if (error) {
    redirect(`/custom-lists/${listId}?error=Could%20not%20restore%20that%20list.`)
  }

  revalidatePath('/custom-lists')
  redirect(`/custom-lists/${listId}`)
}

export async function deleteCustomListAction(formData: FormData) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const listId = normalizeText(formData.get('list_id'))

  if (!listId) {
    redirect('/custom-lists')
  }

  const accessibleList = await getAccessibleListOrRedirect({
    admin,
    permissions,
    listId,
    redirectTo: '/custom-lists',
  })

  await assertCanManageCustomListsInContext({
    admin,
    permissions,
    localUnitId: accessibleList.localUnitId,
    redirectTo: `/custom-lists/${listId}`,
  })

  const { error } = await admin
    .from('custom_lists')
    .delete()
    .eq('id', listId)

  if (error) {
    redirect(`/custom-lists/${listId}?error=Could%20not%20delete%20that%20list.`)
  }

  revalidatePath('/custom-lists')
  redirect('/custom-lists')
}

export async function rememberCustomListAreaContextAction() {
  const values = await getCurrentAreaContextCookieValues()
  if (values.currentAccessContextKey) {
    revalidatePath('/custom-lists')
  }
}
