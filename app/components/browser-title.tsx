'use client'

import { useEffect } from 'react'

export default function BrowserTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = title
  }, [title])

  return null
}
