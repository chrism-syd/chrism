'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import styles from './back-to-people-button.module.css'

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
      {isPending ? (
        <span className={styles.star} aria-hidden="true">✣</span>
      ) : (
        <span aria-hidden="true">‹</span>
      )}
    </button>
  )
}
