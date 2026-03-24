import type { SupabaseClient } from '@supabase/supabase-js'
import type { CurrentUserPermissions } from '@/lib/auth/permissions'

export type CustomListRow = {
  id: string
  council_id: string
  name: string
  description: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  created_by_auth_user_id: string | null
  updated_by_auth_user_id: string | null
}

export type CustomListMemberRow = {
  id: string
  custom_list_id: string
  person_id: string
  claimed_by_person_id: string | null
  claimed_at: string | null
  last_contact_at: string | null
  last_contact_by_person_id: string | null
  added_at: string
}

export type CustomListAccessRow = {
  id: string
  custom_list_id: string
  person_id: string | null
  user_id: string | null
  grantee_email: string | null
  granted_at: string
  granted_by_auth_user_id: string | null
}

export function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null
}

export function buildCustomListAccessMatch(permissions: CurrentUserPermissions) {
  if (permissions.isDevMode) {
    return null
  }

  const parts = [
    permissions.authUser?.id ? `user_id.eq.${permissions.authUser.id}` : '',
    permissions.personId ? `person_id.eq.${permissions.personId}` : '',
    permissions.email ? `grantee_email.eq.${normalizeEmail(permissions.email)}` : '',
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(',') : null
}

export async function listSharedCustomListIdsForUser(args: {
  admin: SupabaseClient
  permissions: CurrentUserPermissions
}) {
  const accessMatch = buildCustomListAccessMatch(args.permissions)

  if (!accessMatch) {
    return [] as string[]
  }

  const { data, error } = await args.admin
    .from('custom_list_access')
    .select('custom_list_id')
    .or(accessMatch)

  if (error) {
    throw new Error(`Could not load custom list access: ${error.message}`)
  }

  return [...new Set(((data as Array<{ custom_list_id: string }> | null) ?? []).map((row) => row.custom_list_id))]
}

export async function hasSharedCustomListsForUser(args: {
  admin: SupabaseClient
  permissions: CurrentUserPermissions
}) {
  const accessMatch = buildCustomListAccessMatch(args.permissions)

  if (!accessMatch) {
    return false
  }

  const { data, error } = await args.admin
    .from('custom_list_access')
    .select('id')
    .or(accessMatch)
    .limit(1)

  if (error) {
    throw new Error(`Could not load custom list access: ${error.message}`)
  }

  return Boolean(data && data.length > 0)
}

export async function canViewCustomList(args: {
  admin: SupabaseClient
  permissions: CurrentUserPermissions
  list: Pick<CustomListRow, 'id' | 'council_id'>
}) {
  if (args.permissions.isCouncilAdmin && args.permissions.councilId === args.list.council_id) {
    return true
  }

  const accessMatch = buildCustomListAccessMatch(args.permissions)
  if (!accessMatch) {
    return false
  }

  const { data, error } = await args.admin
    .from('custom_list_access')
    .select('id')
    .eq('custom_list_id', args.list.id)
    .or(accessMatch)
    .limit(1)

  if (error) {
    throw new Error(`Could not verify custom list access: ${error.message}`)
  }

  return Boolean(data && data.length > 0)
}

export function canManageCustomList(permissions: CurrentUserPermissions, list: Pick<CustomListRow, 'council_id'>) {
  return Boolean(permissions.isCouncilAdmin && permissions.councilId === list.council_id)
}


export function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
