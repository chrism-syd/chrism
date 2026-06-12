'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getOtpErrorMessage, getOtpSendErrorMessage } from '@/lib/auth/otp-messages'
import { createClient } from '@/lib/supabase/browser'

type InviteSignInFormProps = {
  acceptPath: string
  inviteeEmail: string
  invitePath: string
}

const RESEND_COOLDOWN_SECONDS = 45

function buildInviteConfirmRedirectUrl(origin: string, invitePath: string) {
  const url = new URL('/admin-invite/confirm', origin)
  url.searchParams.set('next', invitePath)
  return url.toString()
}

export default function InviteSignInForm({ acceptPath, inviteeEmail, invitePath }: InviteSignInFormProps) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [codeRequested, setCodeRequested] = useState(false)
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
  const cleanedCode = verificationCode.replace(/\D/g, '')
  const canSendCode = resendSecondsRemaining === 0 && !sending && !verifying
  const canVerifyCode = cleanedCode.length > 0 && !sending && !verifying

  function startResendCooldown() {
    setNow(Date.now())
    setResendAvailableAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000)
  }

  async function sendVerificationCode() {
    if (!canSendCode) return

    setSending(true)
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

      setCodeRequested(true)
      setVerificationCode('')
      setMessage(
        codeRequested
          ? `We sent a fresh verification code to ${inviteeEmail}.`
          : `We sent a verification code to ${inviteeEmail}. Enter it below to continue.`
      )
      startResendCooldown()
    } catch (error) {
      setMessage(getOtpSendErrorMessage(error))
    } finally {
      setSending(false)
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!cleanedCode) {
      setMessage('Enter the verification code from your email to continue.')
      return
    }

    setVerifying(true)
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

      router.replace(acceptPath)
      router.refresh()
    } catch (error) {
      setMessage(getOtpErrorMessage(error))
    } finally {
      setVerifying(false)
    }
  }

  return (
    <form onSubmit={handleVerifyCode} className="qv-form-grid qv-register-form" style={{ maxWidth: 760 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <h2 className="qv-section-title" style={{ margin: 0, fontSize: 'clamp(26px, 3.2vw, 36px)' }}>
          Verify your email to continue
        </h2>
        <p className="qv-section-subtitle" style={{ margin: 0, maxWidth: 740 }}>
          To help us ensure that you are the authorized invitee, please verify the invited email address before accepting admin access.
        </p>
      </div>

      <div className="qv-card" style={{ margin: 0, padding: '16px 18px' }}>
        <div className="qv-detail-label">Invited email</div>
        <div className="qv-detail-value" style={{ marginTop: 4 }}>{inviteeEmail}</div>
      </div>

      <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="qv-button-secondary" onClick={() => void sendVerificationCode()} disabled={!canSendCode}>
          {sending ? 'Sending...' : resendSecondsRemaining > 0 ? `Resend in ${resendSecondsRemaining}s` : codeRequested ? 'Resend code' : 'Send code'}
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
          placeholder={codeRequested ? 'Enter code' : 'Send a code first'}
          required
        />
      </label>

      <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
        <button type="submit" className="qv-button-primary" disabled={!canVerifyCode}>
          {verifying ? 'Verifying...' : 'Verify and accept access'}
        </button>
      </div>

      {message ? <p className="qv-inline-message qv-auth-message">{message}</p> : null}
    </form>
  )
}
