'use client'

import { useEffect, useRef } from 'react'
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
  const starRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!starRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const animation = starRef.current.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: 900, iterations: Infinity }
    )

    return () => animation.cancel()
  }, [])

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <img
        ref={starRef}
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
