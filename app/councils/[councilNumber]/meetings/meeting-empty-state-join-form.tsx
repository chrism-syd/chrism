'use client'

import { useState } from 'react'
import { buildAuthConfirmRedirectUrl } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/browser'

type MeetingEmptyStateJoinFormProps = {
  councilNumber: string | null
  councilName: string
}

function normalizeErrorMessage(error: unknown) {
  const rawMessage =
    typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : ''

  const message = rawMessage.trim().toLowerCase()

  if (!message) {
    return 'We could not send the email just now. Please try again.'
  }

  if (message.includes('invalid email')) {
    return 'Enter a valid email address.'
  }

  if (message.includes('rate limit') || message.includes('security purposes')) {
    return 'That email has been tried a few times in a row. Please wait a moment, then try again.'
  }

  if (message.includes('network') || message.includes('fetch')) {
    return 'We could not reach the email service just now. Please try again.'
  }

  if (message.includes('otp') || message.includes('email')) {
    return 'We could not send the onboarding email just now. Please try again.'
  }

  return 'We could not send the onboarding email just now. Please try again.'
}

export default function MeetingEmptyStateJoinForm({ councilNumber, councilName }: MeetingEmptyStateJoinFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [sentName, setSentName] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setErrorMessage(null)
    setSentTo(null)
    setSentName(null)

    const supabase = createClient()
    const nextPath = councilNumber
      ? `/me/claim-organization?councilNumber=${encodeURIComponent(councilNumber)}`
      : '/me/claim-organization'
    const emailRedirectTo = buildAuthConfirmRedirectUrl(window.location.origin, nextPath)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
      },
    })

    if (error) {
      setErrorMessage(normalizeErrorMessage(error))
      setLoading(false)
      return
    }

    setSentTo(email)
    setSentName(name)
    setLoading(false)
  }

  return (
    <div className="qv-empty-onboarding-card">
      <div className="qv-empty-onboarding-copy">
        <h2 className="qv-empty-onboarding-title">Invite a council officer to get started</h2>
        <p className="qv-empty-onboarding-text">
          We will send a secure email link so they can start Chrism onboarding for {councilName}.
        </p>
      </div>

      {sentTo ? (
        <div className="qv-inline-message qv-inline-success qv-empty-onboarding-feedback">
          We sent an onboarding email to <strong>{sentName || 'that officer'}</strong> at <strong>{sentTo}</strong>.
          After they open the link, they will land in the council onboarding flow.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="qv-empty-onboarding-form">
          <div className="qv-form-row qv-form-row-2">
            <label className="qv-control">
              <span className="qv-label">Name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. John Smith"
                autoComplete="name"
                required
              />
            </label>

            <label className="qv-control">
              <span className="qv-label">Email address</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                required
              />
            </label>
          </div>

          <div className="qv-empty-onboarding-actions">
            <button type="submit" className="qv-button-primary qv-empty-onboarding-button" disabled={loading}>
              {loading ? 'Sending...' : 'Send email'}
            </button>
          </div>

          {errorMessage ? (
            <p className="qv-inline-message qv-inline-error qv-empty-onboarding-feedback">{errorMessage}</p>
          ) : null}
        </form>
      )}
    </div>
  )
}
