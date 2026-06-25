import Link from 'next/link'
import AppHeader from '@/app/app-header'
import OrganizationAvatar from '@/app/components/organization-avatar'
import SectionMenuBar from '@/app/components/section-menu-bar'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import {
  getDisplayName,
  listProfileChangeReviewSummaries,
  type ProfileChangeReviewField,
} from '@/lib/profile-change-reviews'
import { clearPublicContactInquiryAction, clearReviewDecisionNoticeAction } from './actions'

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
  if (statusCode === 'approved') return 'Approved'
  if (statusCode === 'rejected') return 'Rejected'
  return 'Pending'
}

function statusClassName(statusCode: string) {
  if (statusCode === 'approved') return 'qv-mini-pill'
  if (statusCode === 'rejected') return 'qv-mini-pill qv-mini-pill-draft'
  return 'qv-mini-pill qv-mini-pill-accent'
}

function publicInquiryTypeLabel(code: string | null) {
  if (code === 'volunteer') return 'Volunteer interest'
  if (code === 'membership') return 'Membership interest'
  if (code === 'help_request') return 'Help request'
  if (code === 'other') return 'Other inquiry'
  return 'General question'
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

type PublicContactPayloadSnapshot = {
  captured_person_id?: string | null
  message?: string | null
  submitter_email?: string | null
  recipient_source?: string | null
}

type PublicInquiryRow = {
  id: string
  inquiry_type_code: string | null
  status_code: string | null
  submitter_name: string | null
  reply_to_email: string | null
  submitter_phone: string | null
  subject: string | null
  created_at: string | null
  sent_at: string | null
  failed_at: string | null
  failure_message: string | null
  payload_snapshot: PublicContactPayloadSnapshot | null
}

function capturedPersonIdForInquiry(inquiry: PublicInquiryRow) {
  const value = inquiry.payload_snapshot?.captured_person_id
  return typeof value === 'string' && value.trim() ? value : null
}

export default async function MemberReviewsPage() {
  const { admin, council, localUnitId } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/members',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  })

  const [pendingReviews, recentDecisions, organizationData, publicInquiryData] = await Promise.all([
    listProfileChangeReviewSummaries({
      admin,
      councilId: council.id,
      organizationId: council.organization_id ?? null,
      statusCodes: ['pending'],
      limit: 40,
    }),
    listProfileChangeReviewSummaries({
      admin,
      councilId: council.id,
      organizationId: council.organization_id ?? null,
      statusCodes: ['approved', 'rejected'],
      decisionNoticeState: 'uncleared',
      limit: 12,
    }),
    council.organization_id
      ? admin
          .from('organizations')
          .select('display_name, preferred_name, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)')
          .eq('id', council.organization_id)
          .maybeSingle<Exclude<OrganizationRow, null>>()
      : Promise.resolve({ data: null as OrganizationRow }),
    localUnitId
      ? (admin as any)
          .from('local_unit_public_contact_message_jobs')
          .select('id, inquiry_type_code, status_code, submitter_name, reply_to_email, submitter_phone, subject, created_at, sent_at, failed_at, failure_message, payload_snapshot')
          .eq('local_unit_id', localUnitId)
          .is('cleared_at', null)
          .order('created_at', { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] as PublicInquiryRow[] }),
  ])

  const organization = organizationData.data ?? null
  const organizationName = getEffectiveOrganizationName(organization) ?? council.name ?? 'Organization'
  const effectiveBranding = getEffectiveOrganizationBranding(organization)
  const publicInquiryError = publicInquiryData.error?.message ?? null
  const publicInquiries = ((publicInquiryData.data ?? []) as PublicInquiryRow[])

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
                <h1 className="qv-directory-name">Review queue</h1>
              </div>
              <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
                Review profile changes and public web-form submissions for your local organization.
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
          <div className="qv-stats">
            <div className="qv-stat-card">
              <div className="qv-stat-number">{pendingReviews.length}</div>
              <div className="qv-stat-label">Pending reviews</div>
            </div>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{publicInquiries.length}</div>
              <div className="qv-stat-label">Web submissions</div>
            </div>
          </div>
        </section>

        <SectionMenuBar items={[{ label: 'Review decisions archive', href: '/members/reviews/archive' }]} />

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Pending profile changes</h2>
              <p className="qv-section-subtitle">
                Open a request to compare the current People record against the submitted change.
              </p>
            </div>
          </div>

          {pendingReviews.length === 0 ? (
            <div className="qv-empty">
              <h3 className="qv-empty-title">No profile changes are waiting right now</h3>
              <p className="qv-empty-text">New submitted profile or contact changes will land here.</p>
            </div>
          ) : (
            <div>
              {pendingReviews.map((item) => (
                <div key={item.request.id} className="qv-list-row-card">
                  <div className="qv-list-row-head">
                    <div>
                      <div className="qv-list-row-title">{getDisplayName(item.person)}</div>
                      <div className="qv-review-row-meta">
                        Submitted {formatDateTime(item.request.requested_at)} • {summarizeFields(item.changedFields)}
                      </div>
                    </div>
                    <div className="qv-list-row-actions">
                      <span className={statusClassName(item.request.status_code)}>{statusLabel(item.request.status_code)}</span>
                      <Link href={`/members/reviews/${item.request.id}`} className="qv-link-button qv-button-primary">
                        Review request
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Public web-form submissions</h2>
              <p className="qv-section-subtitle">
                Submissions from the public page form, including volunteer and membership interest. These were also sent by email to the organization admins.
              </p>
            </div>
          </div>

          {publicInquiryError ? (
            <div className="qv-error">
              <strong>Could not load public submissions.</strong>
              <p>{publicInquiryError}</p>
            </div>
          ) : publicInquiries.length === 0 ? (
            <div className="qv-empty">
              <h3 className="qv-empty-title">No public submissions yet</h3>
              <p className="qv-empty-text">Messages from the public contact form will appear here after someone submits the form.</p>
            </div>
          ) : (
            <div>
              {publicInquiries.map((inquiry, index) => {
                const capturedPersonId = capturedPersonIdForInquiry(inquiry)

                return (
                  <div
                    key={inquiry.id}
                    className="qv-list-row-card"
                    style={{
                      borderTop: index === 0 ? 'none' : '1px solid rgba(92, 74, 114, 0.16)',
                      borderRadius: index === 0 ? undefined : 0,
                      boxShadow: 'none',
                      marginTop: index === 0 ? undefined : 14,
                      paddingTop: index === 0 ? undefined : 16,
                    }}
                  >
                    <div className="qv-list-row-head">
                      <div>
                        <div className="qv-list-row-title">{inquiry.submitter_name ?? 'Unnamed submitter'}</div>
                        <div className="qv-review-row-meta">
                          {publicInquiryTypeLabel(inquiry.inquiry_type_code)} • Submitted {formatDateTime(inquiry.created_at)}
                        </div>
                        <div className="qv-inline-message" style={{ marginTop: 6 }}>
                          {[inquiry.reply_to_email, inquiry.submitter_phone].filter(Boolean).join(' • ') || 'No contact details recorded'}
                        </div>
                        {inquiry.subject ? (
                          <div className="qv-inline-message" style={{ marginTop: 4, color: 'var(--text-primary)' }}>
                            {inquiry.subject}
                          </div>
                        ) : null}
                        {inquiry.status_code === 'failed' && inquiry.failure_message ? (
                          <p className="qv-inline-error" style={{ marginTop: 6 }}>{inquiry.failure_message}</p>
                        ) : null}
                      </div>
                      <div className="qv-list-row-actions">
                        {capturedPersonId ? (
                          <Link href={`/members/${capturedPersonId}`} className="qv-link-button qv-button-secondary">
                            View person
                          </Link>
                        ) : null}
                        <form action={clearPublicContactInquiryAction}>
                          <input type="hidden" name="inquiry_id" value={inquiry.id} />
                          <button type="submit" className="qv-button-secondary">
                            Dismiss
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Recent decisions</h2>
              <p className="qv-section-subtitle">Clear these once you have seen them. The full history stays in the archive.</p>
            </div>
          </div>

          {recentDecisions.length === 0 ? (
            <div className="qv-empty">
              <h3 className="qv-empty-title">No recent decisions are waiting here</h3>
              <p className="qv-empty-text">Approved and rejected changes will appear here until you clear them.</p>
            </div>
          ) : (
            <div>
              {recentDecisions.map((item) => (
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
                      <form action={clearReviewDecisionNoticeAction}>
                        <input type="hidden" name="request_id" value={item.request.id} />
                        <button type="submit" className="qv-button-secondary">
                          Clear
                        </button>
                      </form>
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
