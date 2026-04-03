'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import type { AccessContextOption } from '@/lib/auth/access-contexts'
import type { ActingMode } from '@/lib/auth/super-admin'

type Props = {
  contexts: AccessContextOption[]
  selectedContextKey: string | null
  selectedOrganizationId: string | null
  isSuperAdmin: boolean
  actingMode: ActingMode
  fallbackHref: string
  className?: string
}

function labelForContext(context: AccessContextOption) {
  return context.councilName ?? context.organizationName ?? context.shortLabel
}

export default function PageOrgSwitcher({
  contexts,
  selectedContextKey,
  selectedOrganizationId,
  isSuperAdmin,
  actingMode,
  fallbackHref,
  className,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const options = useMemo(
    () => contexts.filter((context) => context.accessLevel !== 'member' && (context.organizationId || context.councilId)),
    [contexts]
  )

  const initialValue = useMemo(() => {
    if (isSuperAdmin) {
      return selectedOrganizationId ?? options[0]?.organizationId ?? ''
    }
    return selectedContextKey ?? options[0]?.key ?? ''
  }, [isSuperAdmin, options, selectedContextKey, selectedOrganizationId])

  const [value, setValue] = useState(initialValue)

  if (options.length <= 1) return null

  async function apply(nextValue: string) {
    if (!nextValue) return

    if (isSuperAdmin) {
      const response = await fetch('/super-admin/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: actingMode === 'normal' ? 'admin' : actingMode,
          organizationId: nextValue,
        }),
      })
      if (!response.ok) return
      startTransition(() => router.push(fallbackHref))
      return
    }

    const response = await fetch('/account/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contextKey: nextValue }),
    })
    if (!response.ok) return
    startTransition(() => router.push(fallbackHref))
  }

  return (
    <label className={className} style={{ display: 'inline-flex', flexDirection: 'column', gap: 6 }}>
      <span className="qv-label">Organization</span>
      <select
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value
          setValue(nextValue)
          void apply(nextValue)
        }}
        className="qv-dev-mode-select"
        disabled={isPending}
      >
        {options.map((context) => (
          <option
            key={isSuperAdmin ? context.organizationId ?? context.key : context.key}
            value={isSuperAdmin ? context.organizationId ?? '' : context.key}
          >
            {labelForContext(context)}
          </option>
        ))}
      </select>
    </label>
  )
}
