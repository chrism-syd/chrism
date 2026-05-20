'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/browser'

type InviteSignInFormProps = {
  inviteeEmail: string
  invitePath: string
}

function buildInviteConfirmRedirectUrl(origin: string, invitePath: string) {
  const url = new URL('/admin-invite/confirm', origin)
  url.searchParams.set('next', invitePath)
  return url.toString()
}

export default function InviteSignInForm({ inviteeEmail, invitePath }: InviteSignInFormProps) {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)

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
      setMessage(error.message)
      setSent(false)
      setLoading(false)
      return
    }

    setSent(true)
    setMessage(`We sent a secure sign-in link to ${inviteeEmail}. Open that email to continue accepting this admin invite.`)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="qv-inline-message qv-inline-success" style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
        <p style={{ margin: 0 }}>{message}</p>
        <p style={{ margin: 0 }}>The link will return you to this admin invite.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
      <button type="submit" className="qv-button-primary" disabled={loading}>
        {loading ? 'Sending...' : `Send sign-in link to ${inviteeEmail}`}
      </button>
      {message ? <p className="qv-inline-message qv-inline-error" style={{ margin: 0 }}>{message}</p> : null}
    </form>
  )
}
