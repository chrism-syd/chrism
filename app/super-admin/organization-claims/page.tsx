import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { approveOrganizationClaimAction, rejectOrganizationClaimAction } from './actions'
import AutoDismissingQueryMessage from '@/app/components/auto-dismissing-query-message'

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
  requested_by_auth_user_id: string | null
  requested_by_person_id: string | null
  organizations:
    | { display_name: string | null; preferred_name: string | null }
    | Array<{ display_name: string | null; preferred_name: string | null }>
    | null
  councils:
    | { name: string | null; council_number: string | null }
    | Array<{ name: string | null; council_number: string | null }>
    | null
}

type ActiveOrganizationAdminAssignmentRow = {
  organization_id: string
  user_id: string | null
  person_id: string | null
  grantee_email: string | null
}

type ActiveCouncilAdminAssignmentRow = {
  council_id: string
  user_id: string | null
  person_id: string | null
  grantee_email: string | null
}

type CouncilOrganizationRow = {
  id: string
  organization_id: string | null
}

type ReviewedClaimItem = ClaimRow & {
  reviewStatusLabel: string
  reviewSummary: string | null
}

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

function claimHasActiveAdminAccess(
  claim: Pick<ClaimRow, 'organization_id' | 'council_id' | 'requested_by_auth_user_id' | 'requested_by_person_id' | 'requester_email'>,
  organizationAssignments: ActiveOrganizationAdminAssignmentRow[],
  councilAssignments: ActiveCouncilAdminAssignmentRow[],
  councilOrganizationById: Map<string, string | null>
) {
  const requesterEmail = normalizeEmail(claim.requester_email)
  const possibleOrganizationIds = [
    claim.council_id ? councilOrganizationById.get(claim.council_id) ?? null : null,
    claim.organization_id,
  ].filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index)

  const matchesIdentity = (assignment: {
    user_id: string | null
    person_id: string | null
    grantee_email: string | null
  }) => {
    if (claim.requested_by_auth_user_id && assignment.user_id === claim.requested_by_auth_user_id) return true
    if (claim.requested_by_person_id && assignment.person_id === claim.requested_by_person_id) return true
    return requesterEmail !== null && normalizeEmail(assignment.grantee_email) === requesterEmail
  }

  const hasOrganizationAdminAccess = possibleOrganizationIds.length > 0
    ? organizationAssignments.some((assignment) => possibleOrganizationIds.includes(assignment.organization_id) && matchesIdentity(assignment))
    : false

  const hasCouncilAdminAccess = claim.council_id
    ? councilAssignments.some((assignment) => assignment.council_id === claim.council_id && matchesIdentity(assignment))
    : false

  return hasOrganizationAdminAccess || hasCouncilAdminAccess
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

function resolveCouncilLabel(claim: ClaimRow) {
  const organization = Array.isArray(claim.organizations) ? claim.organizations[0] : claim.organizations
  const council = Array.isArray(claim.councils) ? claim.councils[0] : claim.councils
  const councilName = claim.requested_council_name ?? council?.name ?? organization?.preferred_name ?? organization?.display_name ?? 'Unlisted council'
  const councilNumber = claim.requested_council_number ?? council?.council_number ?? null

  return {
    councilName,
    councilNumber,
    cityLabel: claim.requested_city ?? 'City not provided',
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OrganizationClaimsQueuePage({ searchParams }: PageProps) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser || !permissions.isSuperAdmin || permissions.actingMode !== 'normal') {
    redirect('/me')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const errorMessage = typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : null
  const noticeMessage = typeof resolvedSearchParams.notice === 'string' ? resolvedSearchParams.notice : null

  const admin = createAdminClient()
  const { data } = await admin
    .from('organization_claim_requests')
    .select(
      'id, status_code, requester_name, requester_email, requester_phone, requested_council_number, requested_council_name, requested_city, request_notes, review_notes, initiated_via_code, created_at, organization_id, council_id, requested_by_auth_user_id, requested_by_person_id, organizations(display_name, preferred_name), councils(name, council_number)'
    )
    .order('created_at', { ascending: false })
    .limit(50)

  const claims = (data as ClaimRow[] | null) ?? []
  const organizationIds = [...new Set(claims.map((claim) => claim.organization_id).filter((id): id is string => Boolean(id)))]
  const councilIds = [...new Set(claims.map((claim) => claim.council_id).filter((id): id is string => Boolean(id)))]

  const [organizationAdminData, councilAdminData, councilData] = await Promise.all([
    organizationIds.length > 0
      ? admin
          .from('organization_admin_assignments')
          .select('organization_id, user_id, person_id, grantee_email')
          .in('organization_id', organizationIds)
          .eq('is_active', true)
      : Promise.resolve({ data: [] as ActiveOrganizationAdminAssignmentRow[] | null }),
    councilIds.length > 0
      ? admin
          .from('council_admin_assignments')
          .select('council_id, user_id, person_id, grantee_email')
          .in('council_id', councilIds)
          .eq('is_active', true)
      : Promise.resolve({ data: [] as ActiveCouncilAdminAssignmentRow[] | null }),
    councilIds.length > 0
      ? admin
          .from('councils')
          .select('id, organization_id')
          .in('id', councilIds)
      : Promise.resolve({ data: [] as CouncilOrganizationRow[] | null }),
  ])

  const activeOrganizationAssignments = (organizationAdminData.data as ActiveOrganizationAdminAssignmentRow[] | null) ?? []
  const activeCouncilAssignments = (councilAdminData.data as ActiveCouncilAdminAssignmentRow[] | null) ?? []
  const councilOrganizationById = new Map(
    (((councilData.data as CouncilOrganizationRow[] | null) ?? [])).map((row) => [row.id, row.organization_id])
  )

  const pendingClaims = claims.filter(
    (claim) =>
      claim.status_code === 'pending' &&
      !claimHasActiveAdminAccess(claim, activeOrganizationAssignments, activeCouncilAssignments, councilOrganizationById)
  )

  const recentlyReviewedClaims: ReviewedClaimItem[] = [
    ...claims
      .filter(
        (claim) =>
          claim.status_code === 'pending' &&
          claimHasActiveAdminAccess(claim, activeOrganizationAssignments, activeCouncilAssignments, councilOrganizationById)
      )
      .map((claim) => ({
        ...claim,
        reviewStatusLabel: 'already active admin',
        reviewSummary: 'Active admin access is already on file. No review action is needed.',
      })),
    ...claims
      .filter((claim) => claim.status_code !== 'pending')
      .map((claim) => ({
        ...claim,
        reviewStatusLabel: claim.status_code,
        reviewSummary: claim.review_notes,
      })),
  ]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 12)

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        {errorMessage ? (
          <AutoDismissingQueryMessage
            kind="error"
            message={errorMessage}
            className="qv-inline-message qv-inline-error"
          />
        ) : null}
        {noticeMessage ? (
          <AutoDismissingQueryMessage
            kind="notice"
            message={noticeMessage}
            className="qv-inline-message qv-inline-success"
          />
        ) : null}

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
                const { councilName, councilNumber, cityLabel } = resolveCouncilLabel(claim)

                return (
                  <div key={claim.id} className="qv-card" style={{ background: 'var(--bg-sunken)', display: 'grid', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div className="qv-eyebrow">{claim.initiated_via_code === 'public_request' ? 'Public request' : 'Signed-in request'}</div>
                        <div style={{ fontWeight: 700 }}>{councilName}{councilNumber ? ` (${councilNumber})` : ''}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>{cityLabel}</div>
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
            {recentlyReviewedClaims.length === 0 ? (
              <p className="qv-inline-message">No reviewed claim requests yet.</p>
            ) : (
              recentlyReviewedClaims.map((claim) => {
                const { councilName } = resolveCouncilLabel(claim)
                return (
                  <div key={claim.id} className="qv-card" style={{ background: 'var(--bg-sunken)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 700 }}>{claim.requester_name}</div>
                      <span className="qv-mini-pill">{claim.reviewStatusLabel}</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 6 }}>
                      {councilName} · {formatWhen(claim.created_at)}
                    </div>
                    {claim.reviewSummary ? <div style={{ marginTop: 6 }}>{claim.reviewSummary}</div> : null}
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
