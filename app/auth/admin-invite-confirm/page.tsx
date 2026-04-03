import AdminInviteConfirmClient from '@/app/admin-invite/confirm/confirm-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function LegacyAdminInviteConfirmPage() {
  return <AdminInviteConfirmClient />
}
