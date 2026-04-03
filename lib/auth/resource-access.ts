import { createAdminClient } from '@/lib/supabase/admin'

export async function hasResourceAccess(args: {
  admin?: ReturnType<typeof createAdminClient>
  userId: string
  localUnitId: string
  resourceType: 'custom_list' | 'event' | 'event_type' | 'all_events'
  resourceKey: string
  minimumAccessLevel: 'read_only' | 'edit_manage' | 'manage' | 'interact'
}) {
  const admin = args.admin ?? createAdminClient()
  const { data, error } = await admin.rpc('has_resource_access', {
    p_user_id: args.userId,
    p_local_unit_id: args.localUnitId,
    p_resource_type: args.resourceType,
    p_resource_key: args.resourceKey,
    p_min_access_level: args.minimumAccessLevel,
  })

  if (error) {
    throw new Error(`Could not evaluate ${args.resourceType} access: ${error.message}`)
  }

  return Boolean(data)
}

export async function listAccessibleCustomListIdsForUser(args: {
  admin?: ReturnType<typeof createAdminClient>
  userId: string
}) {
  const admin = args.admin ?? createAdminClient()
  const { data, error } = await admin.rpc('list_accessible_custom_lists_for_user', {
    p_user_id: args.userId,
  })

  if (error) {
    throw new Error(`Could not list accessible custom lists: ${error.message}`)
  }

  return ((data ?? []) as Array<{ custom_list_id: string; local_unit_id: string | null }>)
    .filter((row) => Boolean(row.custom_list_id))
}

export async function hasEventManagementAccess(args: {
  admin?: ReturnType<typeof createAdminClient>
  userId: string
  localUnitId: string
  eventId: string
}) {
  const admin = args.admin ?? createAdminClient()
  const { data, error } = await admin.rpc('has_event_management_access', {
    p_user_id: args.userId,
    p_local_unit_id: args.localUnitId,
    p_event_id: args.eventId,
  })

  if (error) {
    throw new Error(`Could not evaluate event management access: ${error.message}`)
  }

  return Boolean(data)
}

export async function listManageableEventIdsForUser(args: {
  admin?: ReturnType<typeof createAdminClient>
  userId: string
  localUnitId?: string | null
}) {
  const admin = args.admin ?? createAdminClient()
  const { data, error } = await admin.rpc('list_manageable_event_ids_for_user', {
    p_user_id: args.userId,
    p_local_unit_id: args.localUnitId ?? null,
  })

  if (error) {
    throw new Error(`Could not list manageable events: ${error.message}`)
  }

  return ((data ?? []) as Array<{ event_id: string; local_unit_id: string | null }>)
    .filter((row) => Boolean(row.event_id))
}
