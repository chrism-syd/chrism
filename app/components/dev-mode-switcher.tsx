'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export type SuperAdminOrganizationOption = {
  id: string
  name: string
}

type Props = {
  organizations: SuperAdminOrganizationOption[]
  selectedOrganizationId: string | null
  selectedMode: 'normal' | 'admin' | 'member'
}

export default function DevModeSwitcher({
  organizations,
  selectedOrganizationId,
  selectedMode,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [organizationId, setOrganizationId] = useState(selectedOrganizationId ?? '')

  async function apply(mode: 'normal' | 'admin' | 'member') {
    const response = await fetch('/super-admin/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        organizationId: mode === 'normal' ? null : organizationId || null,
      }),
    })

    if (!response.ok) return

    const destination = mode === 'member' ? '/spiritual' : '/'
    startTransition(() => {
      router.push(destination)
      router.refresh()
    })
  }

  return (
    <div className="qv-dev-mode-panel">
      <h3 className="qv-dev-mode-title">Dev mode</h3>
      <label className="qv-control">
        <span className="qv-label">Preview organization</span>
        <select
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
          className="qv-dev-mode-select"
          disabled={isPending}
        >
          <option value="">Choose an organization</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </label>

      <div className="qv-dev-mode-actions">
        <button
          type="button"
          className={selectedMode === 'admin' ? 'qv-button-primary' : 'qv-button-secondary'}
          disabled={isPending || !organizationId}
          onClick={() => void apply('admin')}
        >
          Admin view
        </button>
        <button
          type="button"
          className={selectedMode === 'member' ? 'qv-button-primary' : 'qv-button-secondary'}
          disabled={isPending || !organizationId}
          onClick={() => void apply('member')}
        >
          Spiritual only
        </button>
      </div>

      <button
        type="button"
        className={selectedMode === 'normal' ? 'qv-button-primary' : 'qv-button-secondary'}
        disabled={isPending}
        onClick={() => void apply('normal')}
      >
        Return to my normal access
      </button>
    </div>
  )
}
