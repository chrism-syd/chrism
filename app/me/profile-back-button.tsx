'use client'

import { useRouter } from 'next/navigation'

export default function ProfileBackButton() {
  const router = useRouter()

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }

    router.push('/spiritual')
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="qv-link-button"
      aria-label="Back"
      style={{
        width: 26,
        height: 26,
        minWidth: 26,
        padding: 0,
        borderRadius: 6,
        border: '1px solid var(--divider-strong)',
        background: 'var(--bg-card)',
        color: 'var(--interactive)',
        fontSize: 18,
        fontWeight: 700,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {'‹'}
    </button>
  )
}
