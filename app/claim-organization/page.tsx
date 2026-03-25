import Link from 'next/link'
import AppHeader from '@/app/app-header'
import CouncilClaimRequestCard from '@/app/components/council-claim-request-card'
import { listCouncilClaimLookupOptions } from '@/lib/organizations/claim-requests'
import { submitPublicOrganizationClaimAction } from './actions'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PublicClaimOrganizationPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const errorMessage = typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : null
  const noticeMessage = typeof resolvedSearchParams.notice === 'string' ? resolvedSearchParams.notice : null
  const options = await listCouncilClaimLookupOptions()

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        {errorMessage ? <p className="qv-inline-message qv-inline-error">{errorMessage}</p> : null}
        {noticeMessage ? <p className="qv-inline-message qv-inline-success">{noticeMessage}</p> : null}

        <CouncilClaimRequestCard
          options={options}
          action={submitPublicOrganizationClaimAction}
          title="Request access to a council"
          description="Use this page if you are new to Chrism or not yet linked to a council profile. We will only connect you after you identify the council yourself or after a review triggered by your request."
          submitLabel="Request access"
          audience="public"
        />

        <section className="qv-card" style={{ marginTop: 18 }}>
          <h2 className="qv-section-title">Already have a sign-in link?</h2>
          <p className="qv-section-subtitle">
            If you already use Chrism, sign in first and submit the same request from your profile. That gives the review queue your linked account context without revealing any hidden member matching.
          </p>
          <div className="qv-form-actions">
            <Link href="/login?next=/me/claim-organization" className="qv-link-button qv-button-primary">
              Sign in first
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
