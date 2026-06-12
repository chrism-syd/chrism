'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getOtpErrorMessage, getOtpSendErrorMessage } from '@/lib/auth/otp-messages'
import { createClient } from '@/lib/supabase/browser'

type InviteSignInFormProps = {
  inviteeEmail: string
  invitePath: string
}

const RESEND_COOLDOWN_SECONDS = 45

function buildInviteConfirmRedirectUrl(origin: string, invitePath: string) {
  const url = new URL('/admin-invite/confirm', origin)
  url.searchParams.set('next', invitePath)
  return url.toString()
}

export default function InviteSignInForm({ inviteeEmail, invitePath }: InviteSignInFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [codeSent, setCodeSent] = useState(true)
  const [verificationCode, setVerificationCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null)
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

  async function sendVerificationCode({ isResend = false }: { isResend?: boolean } = {}) {
    if (isResend && !canResend) return

    if (isResend) {
      setResending(true)
    } else {
      setLoading(true)
    }
    setMessage(null)

    try {
      const supabase = createClient()
      const emailRedirectTo = buildInviteConfirmRedirectUrl(window.location.origin, invitePath)

      const { error } = await supabase.auth.signInWithOtp({
        email: inviteeEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo,
        },
      })

      if (error) {
        setMessage(getOtpSendErrorMessage(error))
        return
      }

      setCodeSent(true)
      setVerificationCode('')
      setMessage(
        isResend
          ? `We sent a fresh verification code to ${inviteeEmail}.`
          : `We sent a verification code to ${inviteeEmail}. Enter it here to continue accepting this admin invite.`
      )
      startResendCooldown()
    } catch (error) {
      setMessage(getOtpSendErrorMessage(error))
    } finally {
      setLoading(false)
      setResending(false)
    }
  }

  async function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await sendVerificationCode()
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanedCode = verificationCode.replace(/\D/g, '')
    if (!cleanedCode) {
      setMessage('Enter the verification code from your email to continue.')
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.verifyOtp({
        email: inviteeEmail,
        token: cleanedCode,
        type: 'email',
      })

      if (error) {
        setMessage(getOtpErrorMessage(error))
        return
      }

      router.replace(invitePath)
      router.refresh()
    } catch (error) {
      setMessage(getOtpErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  if (codeSent) {
    return (
      <form onSubmit={handleVerifyCode} className="qv-form-grid qv-register-form" style={{ maxWidth: 620 }}>
        <div className="qv-auth-success-state">
          <div className="qv-auth-success-icon" aria-hidden="true">#</div>
          <div className="qv-auth-success-copy">
            <h3 className="qv-section-title" style={{ margin: 0, fontSize: 24 }}>Verify your email address</h3>
            <p className="qv-auth-success-text">
              To help us confirm this invite belongs to you, please verify the invited email address before continuing.
            </p>
            <p className="qv-auth-success-text">
              Invited email: <strong>{inviteeEmail}</strong>
            </p>
          </div>
        </div>

        <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
          <button
            type="button"
            className="qv-button-secondary"
            onClick={() => void sendVerificationCode({ isResend: true })}
            disabled={!canResend}
          >
            {resending ? 'Sending...' : resendSecondsRemaining > 0 ? `Resend in ${resendSecondsRemaining}s` : 'Send verification code'}
          </button>
        </div>

        <label className="qv-field">
          <span>Verification code</span>
          <input
            name="token"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value)}
            placeholder="Enter code"
            required
          />
        </label>

        <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
          <button type="submit" className="qv-button-primary" disabled={loading || resending}>
            {loading ? 'Verifying...' : 'Verify and continue'}
          </button>
        </div>

        {message ? <p className="qv-inline-message qv-auth-message">{message}</p> : null}
      </form>
    )
  }

  return (
    <form onSubmit={handleSendCode} className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
      <button type="submit" className="qv-button-primary" disabled={loading}>
        {loading ? 'Sending...' : `Send verification code to ${inviteeEmail}`}
      </button>
      {message ? <p className="qv-inline-message qv-inline-error" style={{ margin: 0 }}>{message}</p> : null}
    </form>
  )
}
