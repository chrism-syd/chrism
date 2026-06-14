'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Props = {
  kind: 'notice' | 'error'
  message: string
  dismissAfterMs?: number
  className?: string
  style?: CSSProperties
  cookieNameToClear?: string
}

export default function AutoDismissingQueryMessage({
  kind,
  message,
  dismissAfterMs = 4000,
  className,
  style,
  cookieNameToClear,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isVisible, setIsVisible] = useState(true)

  const nextUrl = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('notice')
    params.delete('error')
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }, [pathname, searchParams])

  useEffect(() => {
    router.replace(nextUrl, { scroll: false })
  }, [nextUrl, router, message])

  useEffect(() => {
    if (!cookieNameToClear) return

    document.cookie = `${cookieNameToClear}=; Max-Age=0; path=/me/council; SameSite=Lax`
  }, [cookieNameToClear, message])

  useEffect(() => {
    const dismiss = () => setIsVisible(false)
    const timeoutId = window.setTimeout(dismiss, dismissAfterMs)
    const listenerTimeoutId = window.setTimeout(() => {
      document.addEventListener('pointerdown', dismiss, { once: true })
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearTimeout(listenerTimeoutId)
      document.removeEventListener('pointerdown', dismiss)
    }
  }, [dismissAfterMs, message])

  if (!isVisible) return null

  return (
    <section className={className} style={style} aria-live={kind === 'error' ? 'assertive' : 'polite'}>
      <p style={{ margin: 0 }}>{message}</p>
    </section>
  )
}
