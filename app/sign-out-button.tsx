'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

type SignOutButtonProps = {
  compact?: boolean
}

export default function SignOutButton({ compact = false }: SignOutButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSignOut() {
    setLoading(true)
    setErrorMessage('')

    const supabase = createClient()
    const { error } = await supabase.auth.signOut({ scope: 'local' })

    if (error) {
      setErrorMessage(error.message)
      setLoading(false)
      return
    }

    router.replace('/login')
    router.refresh()
  }

  return (
    <div className={compact ? 'qv-user-menu-signout' : 'qv-top-actions'}>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        className={compact ? 'qv-user-menu-link' : 'qv-button-secondary'}
      >
        {loading ? 'Signing out...' : 'Sign out'}
      </button>

      {errorMessage ? <p className="qv-inline-error">{errorMessage}</p> : null}
    </div>
  )
}
