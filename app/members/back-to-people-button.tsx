'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import styles from './back-to-people-button.module.css'

function PendingStar() {
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
    <img
      ref={starRef}
      src="/chrism_star.png"
      alt=""
      aria-hidden="true"
      className={styles.star}
    />
  )
}

export default function BackToPeopleButton() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  return (
    <button
      type="button"
      aria-label="Back to people"
      className={styles.button}
      onClick={() => {
        setIsPending(true)
        router.push('/people')
      }}
      disabled={isPending}
    >
      {isPending ? <PendingStar /> : <span aria-hidden="true">‹</span>}
    </button>
  )
}
