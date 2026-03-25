import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { approveOrganizationClaimAction, rejectOrganizationClaimAction } from './actions'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type ClaimRow = {
  id: string
  status_code: string
  requester_name: string
  requester_email: string
  requester_phone: string | null
  requested_council_number: string | null
  requested_council_name: string | null
  requested_city: string | null
  request_notes: string | null
  review_notes: string | null
  initiated_via_code: string
  created_at: string
  organization_id: string | null
  council_id: string | null
  organizations:
    | { display_name: string | null; preferred_name: string | null }
    | Array<{ display_name: string | null; preferred_name: string | null }>
    | null
  councils:
    | { name: string | null; council_number: string | null }
    | Array<{ name: string | null; council_number: string | null }>
    | null
}

function formatWhen(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OrganizationClaimsQueuePage({ searchParams }: PageProps) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser || !permissions.isSuperAdmin) {
    redirect('/me')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const errorMessage = typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : null
  const noticeMessage = typeof resolvedSearchParams.notice === 'string' ? resolvedSearchParams.notice : null

  const admin = createAdminClient()
  const { data } = await admin
    .from('organization_claim_requests')
    .select(
      'id, status_code, requester_name, requester_email, requester_phone, requested_council_number, requested_council_name, requested_city, request_notes, review_notes, initiated_via_code, created_at, organization_id, council_id, organizations(display_name, preferred_name), councils(name, council_number)'
    )
    .order('created_at', { ascending: false })
    .limit(50)

  const claims = (data as ClaimRow[] | null) ?? []
  const pendingClaims = claims.filter((claim) => claim.status_code === 'pending')
  const reviewedClaims = claims.filter((claim) => claim.status_code !== 'pending').slice(0, 12)

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        {errorMessage ? <p className="qv-inline-message qv-inline-error">{errorMessage}</p> : null}
        {noticeMessage ? <p className="qv-inline-message qv-inline-success">{noticeMessage}</p> : null}

        <section className="qv-card">
          <h1 className="qv-section-title">Organization claim requests</h1>
          <p className="qv-section-subtitle">
            Review queued council access requests here after checking the state database or other supporting records.
          </p>
        </section>

        <section className="qv-card" style={{ marginTop: 18 }}>
          <h2 className="qv-section-title">Pending review</h2>
          <div style={{ display: 'grid', gap: 16, marginTop: 14 }}>
            {pendingClaims.length === 0 ? (
              <p className="qv-inline-message">No pending claim requests right now.</p>
            ) : (
              pendingClaims.map((claim) => {
                const organization = Array.isArray(claim.organizations) ? claim.organizations[0] : claim.organizations
                const council = Array.isArray(claim.councils) ? claim.councils[0] : claim.councils
                const resolvedCouncilName = claim.requested_council_name ?? council?.name ?? organization?.preferred_name ?? organization?.display_name ?? 'Unlisted council'
                const resolvedCouncilNumber = claim.requested_council_number ?? council?.council_number ?? null
                return (
                  <div key={claim.id} className="qv-card" style={{ background: 'var(--bg-sunken)', display: 'grid', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div className="qv-eyebrow">{claim.initiated_via_code === 'public_request' ? 'Public request' : 'Signed-in request'}</div>
                        <div style={{ fontWeight: 700 }}>{resolvedCouncilName}{resolvedCouncilNumber ? ` (${resolvedCouncilNumber})` : ''}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>{claim.requested_city ?? 'City not provided'}</div>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Submitted {formatWhen(claim.created_at)}</div>
                    </div>

                    <div style={{ display: 'grid', gap: 4 }}>
                      <div><strong>Requester:</strong> {claim.requester_name}</div>
                      <div><strong>Email:</strong> {claim.requester_email}</div>
                      {claim.requester_phone ? <div><strong>Phone:</strong> {claim.requester_phone}</div> : null}
                      {claim.request_notes ? <div><strong>Notes:</strong> {claim.request_notes}</div> : null}
                    </div>

                    {!claim.organization_id ? (
                      <div className="qv-inline-message qv-inline-error">
                        This request is not tied to a listed council yet. Seed the council lookup data first, then approve it.
                      </div>
                    ) : null}

                    <div className="qv-form-row" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                      <form action={approveOrganizationClaimAction} style={{ display: 'grid', gap: 10 }}>
                        <input type="hidden" name="claim_id" value={claim.id} />
                        <label className="qv-control">
                          <span className="qv-label">Approval notes</span>
                          <textarea name="review_notes" rows={3} placeholder="Verified in state database." />
                        </label>
                        <button type="submit" className="qv-button-primary" disabled={!claim.organization_id}>
                          Approve request
                        </button>
                      </form>

                      <form action={rejectOrganizationClaimAction} style={{ display: 'grid', gap: 10 }}>
                        <input type="hidden" name="claim_id" value={claim.id} />
                        <label className="qv-control">
                          <span className="qv-label">Rejection notes</span>
                          <textarea name="review_notes" rows={3} placeholder="Why the request could not be approved." />
                        </label>
                        <button type="submit" className="qv-button-secondary">
                          Reject request
                        </button>
                      </form>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        <section className="qv-card" style={{ marginTop: 18 }}>
          <h2 className="qv-section-title">Recently reviewed</h2>
          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            {reviewedClaims.length === 0 ? (
              <p className="qv-inline-message">No reviewed claim requests yet.</p>
            ) : (
              reviewedClaims.map((claim) => (
                <div key={claim.id} className="qv-card" style={{ background: 'var(--bg-sunken)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 700 }}>{claim.requester_name}</div>
                    <span className="qv-mini-pill">{claim.status_code}</span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 6 }}>
                    {claim.requested_council_name ?? 'Council request'} · {formatWhen(claim.created_at)}
                  </div>
                  {claim.review_notes ? <div style={{ marginTop: 6 }}>{claim.review_notes}</div> : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
