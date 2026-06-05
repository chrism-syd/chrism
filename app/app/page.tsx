import { redirect } from 'next/navigation'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'

export default async function AppEntryPage() {
  const permissions = await getCurrentUserPermissions()

  if (!permissions.isSignedIn) {
    redirect('/login?next=/app')
  }

  if (permissions.isSuperAdmin && permissions.actingMode === 'member') {
    redirect('/me')
  }

  if (!permissions.hasStaffAccess) {
    redirect('/me')
  }

  if (permissions.canManageEvents) {
    redirect('/events')
  }

  if (permissions.canAccessMemberData) {
    redirect('/members')
  }

  if (permissions.canManageCustomLists) {
    redirect('/custom-lists')
  }

  if (permissions.canAccessOrganizationSettings || permissions.canManageAdmins) {
    redirect('/me/council')
  }

  redirect('/me')
}
