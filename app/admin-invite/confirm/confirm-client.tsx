'use client'

import Link from 'next/link'
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
      <main className="qv-page">
        <div className="qv-shell">
          <section className="qv-card qv-compact-card">
            <h1 className="qv-section-title">Finishing your admin invite</h1>
            <p className="qv-section-subtitle" style={{ marginTop: 12 }}>
              One moment while we confirm your email link and bring you to the invite acceptance screen.
            </p>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <section className="qv-card qv-compact-card">
          <h1 className="qv-section-title">Admin invite link could not be completed</h1>
          <p className="qv-inline-message qv-inline-error" style={{ marginTop: 16 }}>
            {errorMessage}
          </p>
          <div className="qv-form-actions" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
            <Link href="/login" className="qv-link-button qv-button-primary">
              Go to sign in
            </Link>
            <Link href="/admin-invite/invalid?reason=auth" className="qv-link-button">
              Open invite help
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
