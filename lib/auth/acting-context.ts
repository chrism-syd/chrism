import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserPermissions, type CurrentUserPermissions } from '@/lib/auth/permissions'

export type ActingCouncilRow = {
  id: string
  name: string | null
  council_number: string | null
  organization_id: string | null
}

export type ActingCouncilContext = {
  admin: ReturnType<typeof createAdminClient>
  permissions: CurrentUserPermissions
  council: ActingCouncilRow
}

export async function getCurrentActingCouncilContext(options?: {
  requireAdmin?: boolean
  redirectTo?: string
}): Promise<ActingCouncilContext> {
  const requireAdmin = options?.requireAdmin ?? false
  const redirectTo = options?.redirectTo ?? '/me'
  const permissions = await getCurrentUserPermissions()

  if (!permissions.authUser) redirect('/login')
  if (!permissions.councilId || !permissions.hasStaffAccess) redirect(redirectTo)
  if (requireAdmin && !permissions.isCouncilAdmin) redirect('/me')

  const admin = createAdminClient()
  const { data: councilData } = await admin
    .from('councils')
    .select('id, name, council_number, organization_id')
    .eq('id', permissions.councilId)
    .maybeSingle()

  const council = (councilData as ActingCouncilRow | null) ?? null
  if (!council) redirect(redirectTo)

  return { admin, permissions, council }
}

export const requireActingCouncilContext = getCurrentActingCouncilContext
