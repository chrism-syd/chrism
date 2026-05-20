'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

type Phase = 'verifying' | 'failed'

function sanitizeNextPath(value: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) return null
  if (trimmed.startsWith('//')) return null
  return trimmed
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="qv-page">
      <div className="qv-shell" style={{ minHeight: '100vh', display: 'grid', alignItems: 'center', paddingBlock: 32 }}>
        <section
          className="qv-card"
          style={{
            maxWidth: 760,
            margin: '0 auto',
            padding: 'clamp(28px, 5vw, 48px)',
            display: 'grid',
            gap: 24,
            overflow: 'hidden',
          }}
        >
          {children}
        </section>
      </div>
    </main>
  )
}

export default function AdminInviteConfirmClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<Phase>('verifying')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const nextPath = useMemo(() => {
    const raw = searchParams.get('next') ?? searchParams.get('redirect_to')
    return sanitizeNextPath(raw) ?? '/admin-invite/invalid?reason=missing'
  }, [searchParams])

  useEffect(() => {
    let isCancelled = false

    async function run() {
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type')
      const supabase = createClient()

      try {
        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            type: type as never,
            token_hash: tokenHash,
          })

          if (!error) {
            if (!isCancelled) {
              router.replace(nextPath)
            }
            return
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session) {
          if (!isCancelled) {
            router.replace(nextPath)
          }
          return
        }

        if (!isCancelled) {
          setPhase('failed')
          setErrorMessage('We could not complete that invite sign-in link. Please request a fresh invite and try again.')
        }
      } catch {
        if (!isCancelled) {
          setPhase('failed')
          setErrorMessage('Something went wrong while completing your invite. Please request a fresh invite and try again.')
        }
      }
    }

    void run()

    return () => {
      isCancelled = true
    }
  }, [nextPath, router, searchParams])

  if (phase === 'verifying') {
    return (
      <InviteShell>
        <div style={{ display: 'grid', gap: 18 }}>
          <Image
            src="/Chrism-ops.svg"
            alt="Chrism"
            width={190}
            height={64}
            priority
            style={{ width: 190, height: 'auto' }}
          />
          <p className="qv-eyebrow" style={{ margin: 0 }}>Secure admin invite</p>
          <h1 className="qv-directory-name" style={{ margin: 0, fontSize: 'clamp(44px, 8vw, 76px)', lineHeight: 0.92 }}>
            Opening your invite
          </h1>
          <p style={{ margin: 0, maxWidth: 560, color: 'var(--text-secondary)', fontSize: 16, fontWeight: 700, lineHeight: 1.45 }}>
            We are confirming your magic link and preparing the local organization admin screen.
          </p>
        </div>

        <div className="qv-detail-list" style={{ marginTop: 0 }}>
          <div className="qv-detail-item" style={{ paddingTop: 0 }}>
            <div className="qv-detail-label">Step 1</div>
            <div className="qv-detail-value">Verify your secure sign-in link</div>
          </div>
          <div className="qv-detail-item">
            <div className="qv-detail-label">Step 2</div>
            <div className="qv-detail-value">Review the local organization invitation</div>
          </div>
          <div className="qv-detail-item">
            <div className="qv-detail-label">Step 3</div>
            <div className="qv-detail-value">Accept access and continue to Chrism</div>
          </div>
        </div>
      </InviteShell>
    )
  }

  return (
    <InviteShell>
      <div style={{ display: 'grid', gap: 16 }}>
        <Image
          src="/Chrism-ops.svg"
          alt="Chrism"
          width={190}
          height={64}
          priority
          style={{ width: 190, height: 'auto' }}
        />
        <p className="qv-eyebrow" style={{ margin: 0 }}>Invite help</p>
        <h1 className="qv-section-title" style={{ margin: 0 }}>Admin invite link could not be completed</h1>
        <p className="qv-inline-message qv-inline-error" style={{ marginTop: 0 }}>
          {errorMessage}
        </p>
        <p className="qv-section-subtitle" style={{ marginTop: 0 }}>
          Invite links are intentionally short-lived. Ask the person who invited you to send a fresh admin invite, then open the newest email from Chrism.
        </p>
      </div>
      <div className="qv-form-actions" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
        <Link href="/login" className="qv-link-button qv-button-primary">
          Go to sign in
        </Link>
        <Link href="/admin-invite/invalid?reason=auth" className="qv-link-button">
          Open invite help
        </Link>
      </div>
    </InviteShell>
  )
}
