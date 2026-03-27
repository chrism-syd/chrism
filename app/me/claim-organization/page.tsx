import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import CouncilClaimRequestCard from '@/app/components/council-claim-request-card'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { listCouncilClaimLookupOptions } from '@/lib/organizations/claim-requests'
import { submitSignedInOrganizationClaimAction } from './actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MyClaimOrganizationPage() {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser) {
    redirect('/login?next=/me/claim-organization')
  }

  const options = await listCouncilClaimLookupOptions()

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <CouncilClaimRequestCard
          options={options}
          action={submitSignedInOrganizationClaimAction}
          title="Request council access"
          description="Look up your Knights council in the Greater Toronto Area. If it is not listed yet, switch to Request Access and send the details to the review queue."
          submitLabel="Send request"
          audience="signed_in"
          requesterNameDefault={permissions.email ?? ''}
        />
      </div>
    </main>
  )
}
