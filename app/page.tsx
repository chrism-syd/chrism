import { redirect } from 'next/navigation'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'

export default async function HomePage() {
  const permissions = await getCurrentUserPermissions()

  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  redirect(permissions.hasStaffAccess ? '/members' : '/me')
}
