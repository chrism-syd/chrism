'use client'

import { useEffect } from 'react'

const MESSAGE_QUERY_KEYS = ['notice', 'error'] as const

export default function CleanQueryMessageParams() {
  useEffect(() => {
    const currentUrl = new URL(window.location.href)
    let changed = false

    for (const key of MESSAGE_QUERY_KEYS) {
      if (currentUrl.searchParams.has(key)) {
        currentUrl.searchParams.delete(key)
        changed = true
      }
    }

    if (!changed) return

    const nextSearch = currentUrl.searchParams.toString()
    const nextUrl = currentUrl.pathname + (nextSearch ? '?' + nextSearch : '') + currentUrl.hash
    window.history.replaceState(window.history.state, '', nextUrl)
  }, [])

  return null
}
