'use client'

import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'chrism_admin_invite_phrase_handoff'
const MAX_AGE_MS = 10 * 60 * 1000

type StoredInvitePhrase = {
  email: string
  phrase: string
  createdAt: number
}

function readStoredInvitePhrase() {
  try {
    const rawValue = window.sessionStorage.getItem(STORAGE_KEY)
    if (!rawValue) return null

    const parsed = JSON.parse(rawValue) as Partial<StoredInvitePhrase>
    if (typeof parsed.email !== 'string' || typeof parsed.phrase !== 'string' || typeof parsed.createdAt !== 'number') {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return null
    }

    if (Date.now() - parsed.createdAt > MAX_AGE_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return null
    }

    return {
      email: parsed.email,
      phrase: parsed.phrase,
      createdAt: parsed.createdAt,
    } satisfies StoredInvitePhrase
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}

function pageShowsInviteSentNotice(email: string) {
  const pageText = document.body.textContent ?? ''
  return pageText.includes(`Admin invite sent to ${email}`) || pageText.includes(`Admin invite record created for ${email}`)
}

export default function AdminInvitePhraseHandoff() {
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const [storedPhrase, setStoredPhrase] = useState<StoredInvitePhrase | null>(() => {
    if (typeof window === 'undefined') return null

    const stored = readStoredInvitePhrase()
    if (!stored || !pageShowsInviteSentNotice(stored.email)) return null
    return stored
  })

  useEffect(() => {
    const anchor = anchorRef.current
    const form = anchor?.closest('form')
    if (!form) return

    const inviteForm = form

    function rememberPhrase() {
      const formData = new FormData(inviteForm)
      const email = String(formData.get('grantee_email') ?? '').trim()
      const phrase = String(formData.get('shared_verification_phrase') ?? '').trim()
      if (!email || !phrase) return

      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        email,
        phrase,
        createdAt: Date.now(),
      } satisfies StoredInvitePhrase))
    }

    inviteForm.addEventListener('submit', rememberPhrase)
    return () => inviteForm.removeEventListener('submit', rememberPhrase)
  }, [])

  useEffect(() => {
    if (!storedPhrase) return
    anchorRef.current?.closest('details')?.setAttribute('open', '')
  }, [storedPhrase])

  function dismissPhrase() {
    window.sessionStorage.removeItem(STORAGE_KEY)
    setStoredPhrase(null)
  }

  return (
    <div ref={anchorRef}>
      {storedPhrase ? (
        <section
          className="qv-card"
          aria-live="polite"
          style={{
            background: 'color-mix(in srgb, var(--bg-card) 88%, #f7ecd4)',
            borderColor: 'var(--divider-strong)',
            display: 'grid',
            gap: 10,
            margin: '0 0 4px',
          }}
        >
          <div>
            <p className="qv-detail-label" style={{ margin: 0 }}>Shared verification phrase</p>
            <p className="qv-section-subtitle" style={{ margin: '4px 0 0' }}>
              Send this phrase to {storedPhrase.email} separately from the invite email.
            </p>
          </div>
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--divider)',
              borderRadius: 16,
              color: 'var(--text-primary)',
              fontSize: 'clamp(24px, 3vw, 34px)',
              fontWeight: 900,
              letterSpacing: '0.04em',
              lineHeight: 1.1,
              padding: '16px 18px',
              wordBreak: 'break-word',
            }}
          >
            {storedPhrase.phrase}
          </div>
          <button type="button" className="qv-link-button qv-button-secondary" onClick={dismissPhrase} style={{ width: 'fit-content' }}>
            Hide phrase
          </button>
        </section>
      ) : null}
    </div>
  )
}
