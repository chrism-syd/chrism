'use client'

import { useFormStatus } from 'react-dom'
import type { CSSProperties, ReactNode } from 'react'

type FormSubmitButtonProps = {
  idleLabel: ReactNode
  pendingLabel?: ReactNode
  className?: string
  style?: CSSProperties
  disabled?: boolean
  name?: string
  value?: string
}

function PendingLabel({ label }: { label: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <img
        src="/chrism_star.png"
        alt=""
        aria-hidden="true"
        style={{ width: 16, height: 16, objectFit: 'contain', flexShrink: 0 }}
      />
      <span>{label}</span>
    </span>
  )
}

export default function FormSubmitButton({
  idleLabel,
  pendingLabel = 'Working…',
  className = 'qv-button-secondary',
  style,
  disabled = false,
  name,
  value,
}: FormSubmitButtonProps) {
  const { pending, data } = useFormStatus()
  const isActiveSubmitter = !name || data?.get(name) === value
  const showPending = pending && isActiveSubmitter

  return (
    <button
      type="submit"
      className={className}
      style={style}
      disabled={disabled || pending}
      aria-busy={showPending}
      name={name}
      value={value}
    >
      {showPending ? <PendingLabel label={pendingLabel} /> : idleLabel}
    </button>
  )
}
