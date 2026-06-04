'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { buildAuthConfirmRedirectUrl } from '@/lib/auth/redirects'
import { getOtpErrorMessage, getOtpSendErrorMessage } from '@/lib/auth/otp-messages'
import { createClient } from '@/lib/supabase/browser'
import { markRegistrationEmailVerifiedAction } from './actions'

type VerifyRegistrationCodeFormProps = {
  email: string
}

const RESEND_COOLDOWN_SECONDS = 45

export default function VerifyRegistrationCodeForm({ email }: VerifyRegistrationCodeFormProps) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(() => Date.now() + RESEND_COOLDOWN_SECONDS * 1000)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!resendAvailableAt) return

    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [resendAvailableAt])

  const resendSecondsRemaining = resendAvailableAt ? Math.max(0, Math.ceil((resendAvailableAt - now) / 1000)) : 0
  const canResend = resendSecondsRemaining === 0 && !loading && !resending

  function startResendCooldown() {
    setNow(Date.now())
    setResendAvailableAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000)
  }

  async function handleResendCode() {
    if (!canResend) return

    setResending(true)
    setMessage('')

    const supabase = createClient()
    const emailRedirectTo = buildAuthConfirmRedirectUrl(window.location.origin, '/me')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo,
      },
    })

    if (error) {
      setMessage(getOtpSendErrorMessage(error))
      setResending(false)
      return
    }

    setCode('')
    setMessage('We sent a fresh verification code.')
    startResendCooldown()
    setResending(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    const cleanedCode = code.replace(/\D/g, '')
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: cleanedCode,
      type: 'email',
    })

    if (error) {
      setMessage(getOtpErrorMessage(error))
      setLoading(false)
      return
    }

    const result = await markRegistrationEmailVerifiedAction()
    setMessage(result.message)

    if (!result.ok) {
      setLoading(false)
      return
    }

    setIsVerified(true)
    setLoading(false)
  }

  if (isVerified) {
    return (
      <div className="qv-auth-success-state">
        <div className="qv-auth-success-icon" aria-hidden="true">✓</div>
        <div className="qv-auth-success-copy">
          <h2 className="qv-section-title">Email verified</h2>
          <p className="qv-auth-success-text">{message}</p>
        </div>
        <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
          <button type="button" className="qv-button-primary" onClick={() => router.push('/me')}>
            Continue to profile
          </button>
          <Link href="/login" className="qv-button-secondary qv-link-button">
            Sign in instead
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="qv-form-grid qv-register-form">
      <div className="qv-auth-success-state">
        <div className="qv-auth-success-icon" aria-hidden="true">#</div>
        <div className="qv-auth-success-copy">
          <h2 className="qv-section-title">Enter your verification code</h2>
          <p className="qv-auth-success-text">
            We sent a verification code to <strong>{email}</strong>. Enter it here to verify your email address.
          </p>
        </div>
      </div>

      <label className="qv-field">
        <span>Verification code</span>
        <input
          name="token"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Enter code"
          required
        />
      </label>

      <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
        <button type="submit" className="qv-button-primary" disabled={loading || resending}>
          {loading ? 'Verifying...' : 'Verify email'}
        </button>
        <button type="button" className="qv-button-secondary" onClick={handleResendCode} disabled={!canResend}>
          {resending ? 'Sending...' : resendSecondsRemaining > 0 ? `Resend in ${resendSecondsRemaining}s` : 'Resend code'}
        </button>
      </div>

      {message ? <p className="qv-inline-message qv-auth-message">{message}</p> : null}
    </form>
  )
}
