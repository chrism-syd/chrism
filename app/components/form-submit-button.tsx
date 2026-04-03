'use client'

import { useFormStatus } from 'react-dom'
import type { CSSProperties, ReactNode } from 'react'

type FormSubmitButtonProps = {
  idleLabel: ReactNode
  pendingLabel?: ReactNode
  className?: string
  style?: CSSProperties
  disabled?: boolean
}

export default function FormSubmitButton({
  idleLabel,
  pendingLabel = 'Working…',
  className = 'qv-button-secondary',
  style,
  disabled = false,
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button type="submit" className={className} style={style} disabled={disabled || pending} aria-busy={pending}>
      {pending ? pendingLabel : idleLabel}
    </button>
  )
}
