import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import CouncilClaimRequestCard from '@/app/components/council-claim-request-card'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { listCouncilClaimLookupOptions } from '@/lib/organizations/claim-requests'
import { submitSignedInOrganizationClaimAction } from './actions'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MyClaimOrganizationPage({ searchParams }: PageProps) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser) {
    redirect('/login?next=/me/claim-organization')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const errorMessage = typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : null
  const noticeMessage = typeof resolvedSearchParams.notice === 'string' ? resolvedSearchParams.notice : null
  const options = await listCouncilClaimLookupOptions()
  const initialCouncilNumberQuery = typeof resolvedSearchParams.councilNumber === 'string' ? resolvedSearchParams.councilNumber : null
  const initialCouncilNameQuery = typeof resolvedSearchParams.councilName === 'string' ? resolvedSearchParams.councilName : null
  const initialCityQuery = typeof resolvedSearchParams.city === 'string' ? resolvedSearchParams.city : null

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        {errorMessage ? <p className="qv-inline-message qv-inline-error">{errorMessage}</p> : null}
        {noticeMessage ? <p className="qv-inline-message qv-inline-success">{noticeMessage}</p> : null}

        <CouncilClaimRequestCard
          options={options}
          action={submitSignedInOrganizationClaimAction}
          title="Request council access"
          description="Look up your Knights council in the Greater Toronto Area. If it is not listed yet, switch to Request Access and send the details to the review queue."
          submitLabel="Send request"
          audience="signed_in"
          initialCouncilNumberQuery={initialCouncilNumberQuery}
          initialCouncilNameQuery={initialCouncilNameQuery}
          initialCityQuery={initialCityQuery}
        />
      </div>
    </main>
  )
}
