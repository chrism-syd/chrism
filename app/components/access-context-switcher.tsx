'use client'

import { useEffect, useRef, useState } from 'react'
import type { CurrentUserAccessContext } from '@/lib/auth/access-contexts'

type Props = {
  contexts: CurrentUserAccessContext[]
  selectedContextKey: string | null
}

export default function AccessContextSwitcher({ contexts, selectedContextKey }: Props) {
  const [value, setValue] = useState(selectedContextKey ?? '')
  const [isPending, setIsPending] = useState(false)
  const mountedRef = useRef(false)

  useEffect(() => {
    setValue(selectedContextKey ?? '')
  }, [selectedContextKey])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  async function apply(nextValue: string) {
    setValue(nextValue)
    setIsPending(true)
    try {
      const response = await fetch('/account/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextKey: nextValue || null }),
      })

      if (!response.ok) {
        return
      }

      window.location.reload()
    } finally {
      if (mountedRef.current) {
        setIsPending(false)
      }
    }
  }

  return (
    <label className="qv-control" style={{ minWidth: 240 }}>
      <span className="qv-label">Current organization view</span>
      <select
        className="qv-dev-mode-select"
        value={value}
        disabled={isPending}
        onChange={(event) => {
          const nextValue = event.target.value
          void apply(nextValue)
        }}
      >
        {contexts.map((context) => (
          <option key={context.key} value={context.key}>
            {context.shortLabel}
          </option>
        ))}
      </select>
    </label>
  )
}
