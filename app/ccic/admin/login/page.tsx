'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Suspense, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import '../../../christmas-cards/ccic-admin-login.css'

function getCcicAdminNextPath(value: string | null) {
  if (!value) return '/ccic/admin/orders'
  if (value === '/ccic/admin/orders' || value.startsWith('/ccic/admin/orders/')) return value
  if (value === '/ccic/admin/packing-list') return value
  return '/ccic/admin/orders'
}

function CcicAdminLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setIsError(false)

    try {
      const normalizedEmail = email.trim().toLowerCase()
      const response = await fetch('/api/ccic/admin/auth/request-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null

      if (!response.ok) {
        setMessage(payload?.error || 'We could not send a login code.')
        setIsError(true)
        return
      }

      setEmail(normalizedEmail)
      setEmailSentTo(normalizedEmail)
      setCode('')
      setMessage('A one-time login code has been sent to your email address.')
    } catch {
      setMessage('We could not reach the login service. Please try again.')
      setIsError(true)
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!emailSentTo) return

    setLoading(true)
    setMessage('')
    setIsError(false)

    try {
      const response = await fetch('/api/ccic/admin/auth/verify-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: emailSentTo,
          code: code.replace(/\D/g, ''),
        }),
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null

      if (!response.ok) {
        setMessage(payload?.error || 'That code was not accepted. Check the code and try again.')
        setIsError(true)
        return
      }

      router.push(getCcicAdminNextPath(searchParams.get('next')))
      router.refresh()
    } catch {
      setMessage('We could not verify the code. Please try again.')
      setIsError(true)
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setEmail('')
    setEmailSentTo(null)
    setCode('')
    setMessage('')
    setIsError(false)
  }

  return (
    <main className="ccic-admin-login-page">
      <section className="ccic-admin-login-card">
        <Link className="ccic-admin-login-logo" href="/ccic" aria-label="Return to CCIC storefront">
          <Image src="/CCiC.png" alt="Celebrate Christ in Christmas" width={130} height={130} priority />
        </Link>

        <div className="ccic-admin-login-heading">
          <p>Private order access</p>
          <h1>CCIC order administration</h1>
          <span>
            Access is limited to four authorized email addresses and grants access only to the CCIC order area.
          </span>
        </div>

        {emailSentTo ? (
          <form onSubmit={verifyCode} className="ccic-admin-login-form">
            <label>
              <span>One-time code</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Enter code"
                required
                autoFocus
              />
            </label>

            <p className="ccic-admin-login-sent">Code sent to <strong>{emailSentTo}</strong></p>

            <button type="submit" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify and view orders'}
            </button>
            <button type="button" className="ccic-admin-login-secondary" onClick={reset} disabled={loading}>
              Use a different email
            </button>
          </form>
        ) : (
          <form onSubmit={requestCode} className="ccic-admin-login-form">
            <label>
              <span>Authorized email address</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                required
                autoFocus
              />
            </label>

            <button type="submit" disabled={loading}>
              {loading ? 'Sending code…' : 'Send one-time code'}
            </button>
          </form>
        )}

        {message ? (
          <p className={`ccic-admin-login-message${isError ? ' is-error' : ''}`} role={isError ? 'alert' : 'status'}>
            {message}
          </p>
        ) : null}
      </section>
    </main>
  )
}

export default function CcicAdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <CcicAdminLoginContent />
    </Suspense>
  )
}
