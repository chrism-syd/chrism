'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ChrismPendingStar from '@/app/components/chrism-pending-star'
import styles from './chrism-star-nav-button.module.css'

type ChrismStarNavButtonProps = {
  href: string
  ariaLabel: string
  idleLabel?: string
  size?: number
  className?: string
}

export default function ChrismStarNavButton({
  href,
  ariaLabel,
  idleLabel = '‹',
  size = 16,
  className,
}: ChrismStarNavButtonProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={[styles.button, className].filter(Boolean).join(' ')}
      onClick={() => {
        setIsPending(true)
        router.push(href)
      }}
      disabled={isPending}
    >
      {isPending ? <ChrismPendingStar size={size} className={styles.star} /> : <span aria-hidden="true">{idleLabel}</span>}
    </button>
  )
}
