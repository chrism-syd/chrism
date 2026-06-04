'use client'

import { useEffect } from 'react'

export default function CleanCurrentUrl({ preserveKeys = [] }: { preserveKeys?: string[] }) {
  useEffect(() => {
    const currentUrl = new URL(window.location.href)
    if (!currentUrl.search) return

    const preservedParams = new URLSearchParams()
    for (const key of preserveKeys) {
      const values = currentUrl.searchParams.getAll(key)
      for (const value of values) {
        preservedParams.append(key, value)
      }
    }

    const nextSearch = preservedParams.toString()
    const nextUrl = `${currentUrl.pathname}${nextSearch ? `?${nextSearch}` : ''}${currentUrl.hash}`
    window.history.replaceState(window.history.state, '', nextUrl)
  }, [preserveKeys])

  return null
}
