'use client'

import Link from 'next/link'
import ConfirmActionButton from '@/app/components/confirm-action-button'
import type { AdminCarouselItem } from './page'

type Props = {
  items: AdminCarouselItem[]
  revokeAction: (formData: FormData) => Promise<void>
}

function canLinkToMemberProfile(item: AdminCarouselItem) {
  return Boolean(item.personId && item.profileHref)
}

export default function AdminCarousel({ items, revokeAction }: Props) {
  if (items.length === 0) {
    return (
      <div className="qv-empty" style={{ marginTop: 12 }}>
        <p className="qv-empty-text">No admins are configured yet.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            border: '1px solid var(--divider)',
            borderRadius: 16,
            background: 'var(--bg-sunken)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            minHeight: 220,
          }}
        >
          <div className="qv-detail-label">{item.roleLabel}</div>
          <div className="qv-detail-value">
            {canLinkToMemberProfile(item) ? (
              <Link href={item.profileHref as string} className="qv-member-link" style={{ display: 'inline' }}>
                {item.label}
              </Link>
            ) : (
              item.label
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span className="qv-mini-pill">{item.sourceBadge}</span>
          </div>
          <div style={{ flex: 1, minHeight: 10 }} />
          {item.assignmentId ? (
            <ConfirmActionButton
              triggerLabel="Remove admin"
              confirmTitle="Remove admin access?"
              confirmDescription={item.removeDescription}
              confirmLabel="Remove admin"
              danger
              onConfirm={async () => {
                const formData = new FormData()
                formData.set('assignment_id', item.assignmentId as string)
                formData.set('assignment_table', item.assignmentTable ?? 'organization')
                if (item.personId) {
                  formData.set('person_id', item.personId)
                }
                await revokeAction(formData)
              }}
            />
          ) : (
            <div style={{ minHeight: 44 }} />
          )}
        </div>
      ))}
    </div>
  )
}
