'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function BackToPeopleButton() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  return (
    <button
      type="button"
      aria-label="Back to people"
      className="qv-person-back-button"
      onClick={() => {
        setIsPending(true)
        router.push('/people')
      }}
      disabled={isPending}
    >
      {isPending ? (
        <span className="qv-mini-working-star" aria-hidden="true">✣</span>
      ) : (
        <span aria-hidden="true">‹</span>
      )}
    </button>
  )
}
