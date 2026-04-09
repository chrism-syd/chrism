import Link from 'next/link'
import AppHeader from '@/app/app-header'
import OrganizationAvatar from '@/app/components/organization-avatar'
import SectionMenuBar from '@/app/components/section-menu-bar'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import { getDisplayName, listProfileChangeReviewSummaries, type ProfileChangeReviewField } from '@/lib/profile-change-reviews'

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function summarizeFields(fields: ProfileChangeReviewField[]) {
  if (fields.length === 0) return 'No submitted changes'
  return fields.map((field) => field.label).join(' • ')
}

function statusLabel(statusCode: string) {
  return statusCode === 'approved' ? 'Approved' : 'Rejected'
}

function statusClassName(statusCode: string) {
  return statusCode === 'approved' ? 'qv-mini-pill' : 'qv-mini-pill qv-mini-pill-draft'
}

type OrganizationRow = {
  display_name: string | null
  preferred_name: string | null
  logo_storage_path: string | null
  logo_alt_text: string | null
  brand_profile?: {
    code: string | null
    display_name: string | null
    logo_storage_bucket: string | null
    logo_storage_path: string | null
    logo_alt_text: string | null
  } | null
} | null

export default async function ReviewDecisionArchivePage() {
  const { admin, council } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/members/reviews',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  })

  const [archivedDecisions, organizationData] = await Promise.all([
    listProfileChangeReviewSummaries({
      admin,
      councilId: council.id,
      organizationId: council.organization_id ?? null,
      statusCodes: ['approved', 'rejected'],
      decisionNoticeState: 'all',
      limit: 200,
    }),
    council.organization_id
      ? admin
          .from('organizations')
          .select('display_name, preferred_name, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)')
          .eq('id', council.organization_id)
          .maybeSingle<Exclude<OrganizationRow, null>>()
      : Promise.resolve({ data: null as OrganizationRow }),
  ])

  const organization = organizationData.data ?? null
  const organizationName = getEffectiveOrganizationName(organization) ?? council.name ?? 'Organization'
  const effectiveBranding = getEffectiveOrganizationBranding(organization)

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              <p className="qv-eyebrow">
                {organizationName}
                {council.council_number ? ` (${council.council_number})` : ''}
              </p>
              <div className="qv-directory-title-row">
                <h1 className="qv-directory-name">Review decisions archive</h1>
              </div>
              <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
                Full history of approved and rejected contact change decisions.
              </p>
            </div>
            <div className="qv-org-avatar-wrap">
              <OrganizationAvatar
                displayName={organizationName}
                logoStoragePath={effectiveBranding.logo_storage_path}
                logoAltText={effectiveBranding.logo_alt_text ?? organizationName}
                size={72}
              />
            </div>
          </div>
        </section>

        <SectionMenuBar items={[{ label: 'Back to review queue', href: '/members/reviews' }]} />

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Archived review decisions</h2>
              <p className="qv-section-subtitle">Use this when you need the full decision trail, not just the latest notifications.</p>
            </div>
          </div>

          {archivedDecisions.length === 0 ? (
            <div className="qv-empty">
              <h3 className="qv-empty-title">No review decisions yet</h3>
              <p className="qv-empty-text">Approved and rejected contact changes will appear here.</p>
            </div>
          ) : (
            <div>
              {archivedDecisions.map((item) => (
                <div key={item.request.id} className="qv-list-row-card">
                  <div className="qv-list-row-head">
                    <div>
                      <div className="qv-list-row-title">{getDisplayName(item.person)}</div>
                      <div className="qv-review-row-meta">
                        {statusLabel(item.request.status_code)} {formatDateTime(item.request.reviewed_at)} • {summarizeFields(item.changedFields)}
                      </div>
                    </div>
                    <div className="qv-list-row-actions">
                      <span className={statusClassName(item.request.status_code)}>{statusLabel(item.request.status_code)}</span>
                      <Link href={`/members/reviews/${item.request.id}`} className="qv-link-button qv-button-secondary">
                        View details
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
