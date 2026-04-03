import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppHeader from '@/app/app-header'
import SectionMenuBar from '@/app/components/section-menu-bar'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { getDisplayName, getProfileChangeReviewSummary } from '@/lib/profile-change-reviews'
import { reviewProfileChangeRequestAction } from '../actions'

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

function displayValue(value: string | null, requested?: boolean) {
  if (requested && !value) return 'Clear this value'
  return value?.trim() ? value : 'Not added yet'
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

export default async function ProfileChangeReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { admin, council } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/members/reviews',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  })

  const summary = await getProfileChangeReviewSummary({
    admin,
    councilId: council.id,
    requestId: id,
  })

  if (!summary) {
    notFound()
  }

  const memberName = getDisplayName(summary.person)

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              <p className="qv-eyebrow">Review queue</p>
              <div className="qv-directory-title-row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h1 className="qv-directory-name">{memberName}</h1>
                <span className={statusClassName(summary.request.status_code)}>{statusLabel(summary.request.status_code)}</span>
              </div>
              <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
                Submitted {formatDateTime(summary.request.requested_at)}
                {summary.request.reviewed_at ? ` • Reviewed ${formatDateTime(summary.request.reviewed_at)}` : ''}
              </p>
            </div>
          </div>
        </section>

        <SectionMenuBar
          items={[
            { label: 'Back to review queue', href: '/members/reviews' },
            { label: 'Review decisions archive', href: '/members/reviews/archive' },
          ]}
        />

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Changes to review</h2>
              <p className="qv-section-subtitle">Compare the current record against the change the member submitted.</p>
            </div>
          </div>

          {summary.changedFields.length === 0 ? (
            <div className="qv-empty">
              <h3 className="qv-empty-title">Nothing is waiting in this request</h3>
              <p className="qv-empty-text">This request no longer differs from the member record.</p>
            </div>
          ) : (
            <div className="qv-detail-list">
              {summary.changedFields.map((field) => (
                <div key={field.key} className="qv-detail-item qv-review-change-item">
                  <div className="qv-detail-label">{field.label}</div>
                  <div className="qv-detail-value">Current value: {displayValue(field.currentValue)}</div>
                  <div className="qv-review-change-submitted">
                    <span className="qv-review-change-label">Change submitted</span>
                    <span className="qv-review-change-value">{displayValue(field.proposedValue, field.requested)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Reviewer notes</h2>
              <p className="qv-section-subtitle">Leave context behind so the next person is not guessing.</p>
            </div>
          </div>

          {summary.request.status_code === 'pending' ? (
            <form action={reviewProfileChangeRequestAction} style={{ display: 'grid', gap: 16 }}>
              <input type="hidden" name="request_id" value={summary.request.id} />
              <label style={{ display: 'grid', gap: 8 }}>
                <span className="qv-detail-label">Notes</span>
                <textarea
                  name="review_notes"
                  rows={4}
                  placeholder="Optional context for the review history"
                  defaultValue={summary.request.review_notes ?? ''}
                />
              </label>
              <div className="qv-form-actions">
                <button type="submit" name="decision" value="reject" className="qv-button-secondary">
                  Reject request
                </button>
                <button type="submit" name="decision" value="approve" className="qv-button-primary">
                  Approve changes
                </button>
              </div>
            </form>
          ) : (
            <div className="qv-detail-list">
              <div className="qv-detail-item">
                <div className="qv-detail-label">Decision</div>
                <div className="qv-detail-value">{statusLabel(summary.request.status_code)}</div>
                <div className="qv-detail-meta">Reviewed {formatDateTime(summary.request.reviewed_at)}</div>
              </div>
              <div className="qv-detail-item">
                <div className="qv-detail-label">Notes</div>
                <div className="qv-detail-value">{summary.request.review_notes?.trim() || 'No notes were left on this review.'}</div>
              </div>
              <div className="qv-form-actions" style={{ marginTop: 8 }}>
                <Link href="/members/reviews" className="qv-link-button qv-button-primary">
                  Back to review queue
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
