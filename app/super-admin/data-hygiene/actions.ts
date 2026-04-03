'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'

function buildRedirect(pathname: string, kind: 'notice' | 'error', message: string) {
  const params = new URLSearchParams()
  params.set(kind, message)
  return `${pathname}?${params.toString()}`
}

async function requireSuperAdmin() {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser || !permissions.isSuperAdmin || permissions.actingMode !== 'normal') {
    redirect('/me')
  }
  return permissions
}

export async function cleanupRedundantEventAssignmentsAction() {
  const permissions = await requireSuperAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin.rpc('cleanup_redundant_event_assignments', {
    p_actor_user_id: permissions.authUser!.id,
  })

  if (error) {
    redirect(buildRedirect('/super-admin/data-hygiene', 'error', `Could not clean redundant event assignments. ${error.message}`))
  }

  revalidatePath('/super-admin/data-hygiene')
  redirect(
    buildRedirect(
      '/super-admin/data-hygiene',
      'notice',
      Number(data ?? 0) > 0
        ? `Removed ${Number(data)} redundant event assignment${Number(data) === 1 ? '' : 's'}.`
        : 'No redundant event assignments were found.'
    )
  )
}

export async function resolveSingleNullUserFossilAction(formData: FormData) {
  const permissions = await requireSuperAdmin()
  const sourceTable = String(formData.get('source_table') ?? '').trim()
  const sourceRowId = String(formData.get('source_row_id') ?? '').trim()

  if (!sourceTable || !sourceRowId) {
    redirect(buildRedirect('/super-admin/data-hygiene', 'error', 'Missing fossil row information.'))
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('resolve_null_user_fossils', {
    p_actor_user_id: permissions.authUser!.id,
    p_source_table: sourceTable,
    p_source_row_ids: [sourceRowId],
    p_notes: 'Resolved from the super-admin data hygiene page as intentional migration residue.',
  })

  if (error) {
    redirect(buildRedirect('/super-admin/data-hygiene', 'error', `Could not resolve the fossil row. ${error.message}`))
  }

  revalidatePath('/super-admin/data-hygiene')
  redirect(
    buildRedirect(
      '/super-admin/data-hygiene',
      'notice',
      Number(data ?? 0) > 0 ? 'Fossil row resolved and hidden from the active hygiene queue.' : 'That fossil row was already resolved.'
    )
  )
}

export async function resolveAllNullUserFossilsAction() {
  const permissions = await requireSuperAdmin()
  const admin = createAdminClient()

  const { data, error } = await admin.rpc('resolve_null_user_fossils', {
    p_actor_user_id: permissions.authUser!.id,
    p_notes: 'Resolved from the super-admin data hygiene page as intentional migration residue.',
  })

  if (error) {
    redirect(buildRedirect('/super-admin/data-hygiene', 'error', `Could not resolve the fossil rows. ${error.message}`))
  }

  revalidatePath('/super-admin/data-hygiene')
  redirect(
    buildRedirect(
      '/super-admin/data-hygiene',
      'notice',
      Number(data ?? 0) > 0
        ? `Resolved ${Number(data)} fossil row${Number(data) === 1 ? '' : 's'} and removed them from the active hygiene queue.`
        : 'No unresolved fossil rows were found.'
    )
  )
}
