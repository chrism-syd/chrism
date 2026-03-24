'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { buildAuthConfirmRedirectUrl } from '@/lib/auth/redirects'
import { getLoginMessage } from '@/lib/auth/login-errors'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null)

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    const supabase = createClient()
    const nextPath = searchParams.get('next')
    const emailRedirectTo = buildAuthConfirmRedirectUrl(window.location.origin, nextPath)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo,
      },
    })

    if (error) {
      setMessage(getLoginMessage(error))
      setEmailSentTo(null)
      setLoading(false)
      return
    }

    setEmailSentTo(email)
    setMessage(getLoginMessage(null))
    setLoading(false)
  }

  function resetForm() {
    setEmail('')
    setEmailSentTo(null)
    setMessage('')
  }

  return (
    <main className="qv-page qv-auth-page">
      <div className="qv-auth-shell">
        <section className="qv-auth-card">
          <div className="qv-auth-header">
            <div className="qv-auth-logo-wrap">
              <Image
                src="/Chrism_horiz.svg"
                alt="Chrism"
                width={419}
                height={98}
                priority
                style={{
                  display: 'block',
                  width: '230px',
                  maxWidth: '100%',
                  height: 'auto',
                }}
              />
            </div>

            <div className="qv-auth-heading-wrap">
              <h1 className="qv-auth-title">Sign in with a secure link</h1>
              <p className="qv-auth-text">
                Enter your email address and we will send you a secure sign-in link.
              </p>
            </div>
          </div>

          {emailSentTo ? (
            <div className="qv-auth-success-state">
              <div className="qv-auth-success-icon" aria-hidden="true">✓</div>
              <div className="qv-auth-success-copy">
                <h2 className="qv-auth-success-title">Check your email</h2>
                <p className="qv-auth-success-text">
                  We sent a secure sign-in link to <strong>{emailSentTo}</strong>.
                </p>
                <p className="qv-auth-success-text">
                  After you click the link, return here if needed and the app will continue your sign-in.
                </p>
              </div>
              <button type="button" className="qv-button-secondary" onClick={resetForm}>
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleLogin} className="qv-auth-form">
                <div className="qv-control">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email address"
                    autoComplete="email"
                    required
                  />
                </div>

                <button type="submit" disabled={loading} className="qv-button-primary">
                  {loading ? 'Sending...' : 'Send link'}
                </button>
              </form>

              {message ? (
                <p className="qv-inline-message qv-auth-message">{message}</p>
              ) : null}
            </>
          )}
        </section>

        <div className="qv-auth-footer-link-row">
          <Link href="/about" className="qv-auth-footer-link">
            About us
          </Link>
        </div>
      </div>
    </main>
  )
}
