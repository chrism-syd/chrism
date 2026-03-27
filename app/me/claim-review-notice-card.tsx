import { dismissOrganizationClaimNoticeAction } from '@/app/me/actions'

type Props = {
  claimId: string
  status: 'approved' | 'rejected'
  reviewedAt: string | null
  reviewNotes: string | null
  councilLabel: string | null
}

function formatDateTime(value: string | null) {
  if (!value) return 'Recently'
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function ClaimReviewNoticeCard({
  claimId,
  status,
  reviewedAt,
  reviewNotes,
  councilLabel,
}: Props) {
  const title =
    status === 'approved'
      ? 'Your organization access request was approved.'
      : 'Your organization access request was rejected.'

  const body =
    status === 'approved'
      ? 'Access has been granted. You can now use the organization admin tools available to your account.'
      : 'Access was not granted at this time.'

  return (
    <section className="qv-card" style={{ marginTop: 20 }}>
      <div className="qv-directory-section-head">
        <div>
          <h2 className="qv-section-title">{title}</h2>
          <p className="qv-section-subtitle">
            {councilLabel ? `${councilLabel} · ` : ''}
            Reviewed {formatDateTime(reviewedAt)}
          </p>
        </div>
        <form action={dismissOrganizationClaimNoticeAction}>
          <input type="hidden" name="claim_id" value={claimId} />
          <button type="submit" className="qv-button-secondary">
            Dismiss
          </button>
        </form>
      </div>

      <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
        <p className="qv-inline-message" style={{ margin: 0 }}>
          {body}
        </p>
        {reviewNotes ? (
          <div
            style={{
              background: 'var(--bg-sunken)',
              border: '1px solid var(--divider)',
              borderRadius: 16,
              padding: 16,
            }}
          >
            <div className="qv-detail-label">Reviewer note</div>
            <div className="qv-detail-value" style={{ marginTop: 6 }}>
              {reviewNotes}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
