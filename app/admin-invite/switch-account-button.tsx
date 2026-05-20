'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

type SwitchAccountButtonProps = {
  inviteeEmail: string
  invitePath: string
}

export default function SwitchAccountButton({ inviteeEmail, invitePath }: SwitchAccountButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSwitchAccount() {
    setLoading(true)
    setErrorMessage(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signOut({ scope: 'local' })

    if (error) {
      setErrorMessage(error.message)
      setLoading(false)
      return
    }

    router.replace(`/login?next=${encodeURIComponent(invitePath)}`)
    router.refresh()
  }

  return (
    <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
      <button type="button" onClick={handleSwitchAccount} disabled={loading} className="qv-button-primary">
        {loading ? 'Signing out...' : `Sign in as ${inviteeEmail}`}
      </button>
      {errorMessage ? <p className="qv-inline-message qv-inline-error" style={{ margin: 0 }}>{errorMessage}</p> : null}
    </div>
  )
}
