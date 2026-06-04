'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { markRegistrationEmailVerifiedAction } from './actions'

type VerifyRegistrationCodeFormProps = {
  email: string
}

export default function VerifyRegistrationCodeForm({ email }: VerifyRegistrationCodeFormProps) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

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
      setMessage(error.message)
      setLoading(false)
      return
    }

    const result = await markRegistrationEmailVerifiedAction()
    if (!result.ok) {
      setMessage(result.message)
      setLoading(false)
      return
    }

    router.push('/me')
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
        <button type="submit" className="qv-button-primary" disabled={loading}>
          {loading ? 'Verifying...' : 'Verify email'}
        </button>
      </div>

      {message ? <p className="qv-inline-message qv-auth-message">{message}</p> : null}
    </form>
  )
}
