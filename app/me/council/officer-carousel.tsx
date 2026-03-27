'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import ConfirmActionButton from '@/app/components/confirm-action-button'
import type { OfficerCarouselItem } from './page'

type Props = {
  items: OfficerCarouselItem[]
  saveOfficerRoleEmailAction: (formData: FormData) => Promise<void>
  removeOfficerTermAction: (formData: FormData) => Promise<void>
}

export default function OfficerCarousel({
  items,
  saveOfficerRoleEmailAction,
  removeOfficerTermAction,
}: Props) {
  const pageSize = 3
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const pageItems = items.slice(page * pageSize, page * pageSize + pageSize)
  const dots = useMemo(() => Array.from({ length: totalPages }, (_, idx) => idx), [totalPages])

  if (items.length === 0) {
    return (
      <div className="qv-empty" style={{ marginTop: 20 }}>
        <p className="qv-empty-text">No officer assignments recorded yet.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        {pageItems.map((item) => (
          <div
            key={item.id}
            style={{
              border: '1px solid var(--divider)',
              borderRadius: 16,
              background: 'var(--bg-sunken)',
              padding: 16,
              display: 'grid',
              gap: 10,
              alignContent: 'start',
            }}
          >
            <div className="qv-detail-label">{item.officeLabel}</div>
            <div className="qv-detail-value">
              {item.personId ? (
                <Link href={`/members/${item.personId}`} className="qv-member-link" style={{ display: 'inline' }}>
                  {item.memberLabel}
                </Link>
              ) : (
                item.memberLabel
              )}
            </div>
            <div className="qv-inline-message">{item.serviceLabel}</div>
            <form action={saveOfficerRoleEmailAction} style={{ display: 'grid', gap: 8 }}>
              <input type="hidden" name="term_id" value={item.id} />
              <label className="qv-control" style={{ gap: 6 }}>
                <span className="qv-label">Official office email</span>
                <input type="email" name="official_email" defaultValue={item.officeEmail} placeholder="office@example.org" />
              </label>
              <button type="submit" className="qv-link-button">Save office email</button>
            </form>
            <ConfirmActionButton
              triggerLabel="End term"
              confirmTitle="End officer term?"
              confirmDescription={`This will end ${item.officeLabel} for ${item.memberLabel}. The service history will stay on file.`}
              confirmLabel="End term"
              danger
              action={removeOfficerTermAction}
              hiddenFields={[{ name: 'term_id', value: item.id }]}
            />
          </div>
        ))}
      </div>

      {totalPages > 1 ? (
        <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="qv-button-secondary"
              disabled={page === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              ←
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              {dots.map((dot) => (
                <button
                  key={dot}
                  type="button"
                  onClick={() => setPage(dot)}
                  aria-label={`Show officer page ${dot + 1}`}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '999px',
                    border: '1px solid var(--divider)',
                    background: dot === page ? 'var(--interactive)' : 'transparent',
                    padding: 0,
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              className="qv-button-secondary"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
            >
              →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
