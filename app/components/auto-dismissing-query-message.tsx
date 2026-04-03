'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Props = {
  kind: 'notice' | 'error'
  message: string
  dismissAfterMs?: number
  className?: string
  style?: CSSProperties
}

export default function AutoDismissingQueryMessage({
  kind,
  message,
  dismissAfterMs = 4000,
  className,
  style,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isVisible, setIsVisible] = useState(true)

  const nextUrl = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(kind)
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }, [kind, pathname, searchParams])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsVisible(false)
      router.replace(nextUrl, { scroll: false })
    }, dismissAfterMs)

    return () => window.clearTimeout(timeoutId)
  }, [dismissAfterMs, nextUrl, router, message])

  if (!isVisible) return null

  return (
    <section className={className} style={style} aria-live="polite">
      <p style={{ margin: 0 }}>{message}</p>
    </section>
  )
}
