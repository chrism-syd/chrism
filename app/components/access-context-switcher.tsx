'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { AccessContextOption } from '@/lib/auth/access-contexts'

type Props = {
  contexts: AccessContextOption[]
  selectedContextKey: string | null
}

export default function AccessContextSwitcher({ contexts, selectedContextKey }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [contextKey, setContextKey] = useState(selectedContextKey ?? '')

  async function apply(nextContextKey: string) {
    const response = await fetch('/account/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contextKey: nextContextKey || null }),
    })

    if (!response.ok) return

    startTransition(() => router.refresh())
  }

  return (
    <div className="qv-dev-mode-panel">
      <h3 className="qv-dev-mode-title">Organization view</h3>
      <label className="qv-control">
        <span className="qv-label">Current organization view</span>
        <select
          value={contextKey}
          onChange={(event) => {
            const nextValue = event.target.value
            setContextKey(nextValue)
            void apply(nextValue)
          }}
          className="qv-dev-mode-select"
          disabled={isPending}
        >
          {contexts.map((context) => (
            <option key={context.key} value={context.key}>
              {context.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
