'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'

type LocalPageModalButtonProps = {
  label: string
  title: string
  className?: string
  iframeSrc?: string | null
  children?: ReactNode
}

export default function LocalPageModalButton({
  label,
  title,
  className = 'qv-link-button qv-button-secondary',
  iframeSrc = null,
  children,
}: LocalPageModalButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <>
      <button type="button" className={className} onClick={() => setIsOpen(true)}>
        {label}
      </button>

      {isOpen ? (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false)
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'rgba(46, 42, 52, 0.52)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              width: 'min(90vw, 1180px)',
              maxHeight: '90vh',
              minHeight: iframeSrc ? '72vh' : 'auto',
              overflow: 'hidden',
              borderRadius: 24,
              background: '#fdfcf9',
              boxShadow: '0 28px 90px rgba(46, 42, 52, 0.26)',
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 18,
                padding: '18px 22px',
                borderBottom: '1px solid var(--divider)',
              }}
            >
              <h2 id={titleId} className="qv-section-title" style={{ margin: 0, fontSize: 24 }}>
                {title}
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setIsOpen(false)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 42,
                  height: 42,
                  borderRadius: 999,
                  border: '1px solid var(--divider)',
                  background: 'white',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: 24,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </header>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              {iframeSrc ? (
                <iframe
                  src={iframeSrc}
                  title={title}
                  style={{ width: '100%', height: '100%', minHeight: '72vh', border: 0, display: 'block' }}
                />
              ) : (
                <div style={{ padding: 28 }}>{children}</div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
