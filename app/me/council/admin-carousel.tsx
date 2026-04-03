'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
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
  const [index, setIndex] = useState(0)
  const total = items.length
  const current = items[index] ?? null

  const canPrev = index > 0
  const canNext = index < total - 1

  const dots = useMemo(() => Array.from({ length: total }, (_, idx) => idx), [total])

  if (total === 0) {
    return (
      <div className="qv-empty" style={{ marginTop: 12 }}>
        <p className="qv-empty-text">No admins are configured yet.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
      {current ? (
        <div
          style={{
            border: '1px solid var(--divider)',
            borderRadius: 16,
            background: 'var(--bg-sunken)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            minHeight: 264,
          }}
        >
          <div className="qv-detail-label">{current.roleLabel}</div>
          <div className="qv-detail-value">
            {canLinkToMemberProfile(current) ? (
              <Link href={current.profileHref as string} className="qv-member-link" style={{ display: 'inline' }}>
                {current.label}
              </Link>
            ) : (
              current.label
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span className="qv-mini-pill">{current.sourceBadge}</span>
          </div>
          <div style={{ flex: 1, minHeight: 10 }} />
          {current.assignmentId ? (
            <ConfirmActionButton
              triggerLabel="Remove admin"
              confirmTitle="Remove admin access?"
              confirmDescription={current.removeDescription}
              confirmLabel="Remove admin"
              danger
              action={revokeAction}
              hiddenFields={[
                { name: 'assignment_id', value: current.assignmentId },
                { name: 'assignment_table', value: current.assignmentTable ?? 'organization' },
              ]}
            />
          ) : (
            <div style={{ minHeight: 44 }} />
          )}
        </div>
      ) : null}

      {total > 1 ? (
        <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" className="qv-button-secondary" disabled={!canPrev} onClick={() => setIndex((value) => Math.max(0, value - 1))}>
              ←
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              {dots.map((dot) => (
                <button
                  key={dot}
                  type="button"
                  onClick={() => setIndex(dot)}
                  aria-label={`Show admin ${dot + 1}`}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '999px',
                    border: '1px solid var(--divider)',
                    background: dot === index ? 'var(--interactive)' : 'transparent',
                    padding: 0,
                  }}
                />
              ))}
            </div>
            <button type="button" className="qv-button-secondary" disabled={!canNext} onClick={() => setIndex((value) => Math.min(total - 1, value + 1))}>
              →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
