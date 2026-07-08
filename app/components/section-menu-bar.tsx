'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import ChrismPendingStar from '@/app/components/chrism-pending-star'

type SectionMenuItem = {
  label: string
  href: string
}

type Props = {
  items: SectionMenuItem[]
  mobileLabel?: string
}

function PendingLabel() {
  return (
    <span className="qv-section-menu-pending-label">
      <ChrismPendingStar size={16} />
      <span>Working</span>
    </span>
  )
}

export default function SectionMenuBar({ items, mobileLabel = 'Section menu' }: Props) {
  const [open, setOpen] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  return (
    <div className="qv-section-menu-shell" ref={containerRef}>
      <nav className="qv-section-menu-desktop" aria-label="Section actions">
        {items.map((item) => {
          const isPending = pendingHref === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className="qv-section-menu-link"
              aria-disabled={isPending ? 'true' : undefined}
              onClick={() => setPendingHref(item.href)}
            >
              {isPending ? <PendingLabel /> : item.label}
            </Link>
          )
        })}
      </nav>

      <div className="qv-section-menu-mobile">
        <button
          type="button"
          className="qv-section-menu-trigger"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((current) => !current)}
        >
          <span>{mobileLabel}</span>
          <span aria-hidden="true" className="qv-section-menu-trigger-icon">{open ? '▴' : '▾'}</span>
        </button>

        {open ? (
          <div className="qv-section-menu-overlay" role="menu">
            {items.map((item) => {
              const isPending = pendingHref === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  className="qv-section-menu-overlay-link"
                  aria-disabled={isPending ? 'true' : undefined}
                  onClick={() => {
                    setPendingHref(item.href)
                    setOpen(false)
                  }}
                >
                  {isPending ? <PendingLabel /> : item.label}
                </Link>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
