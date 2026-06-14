'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const COUNCIL_SETTINGS_FLASH_COOKIE = 'chrism_council_settings_flash'

type FlashKind = 'notice' | 'error'

type FlashMessage = {
  kind: FlashKind
  message: string
}

function readCookie(name: string) {
  if (typeof document === 'undefined') return null

  const prefix = `${name}=`
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))

  if (!cookie) return null

  return decodeURIComponent(cookie.slice(prefix.length))
}

function readFlashCookie() {
  const rawValue = readCookie(COUNCIL_SETTINGS_FLASH_COOKIE)
  if (!rawValue) return null

  try {
    const parsed = JSON.parse(rawValue) as Partial<FlashMessage>
    if ((parsed.kind === 'notice' || parsed.kind === 'error') && typeof parsed.message === 'string' && parsed.message.trim()) {
      return {
        kind: parsed.kind,
        message: parsed.message.trim(),
      }
    }
  } catch {
    return null
  }

  return null
}

function clearFlashCookie() {
  document.cookie = `${COUNCIL_SETTINGS_FLASH_COOKIE}=; Max-Age=0; path=/me/council; SameSite=Lax`
}

export default function CouncilSettingsFlashMessage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [flash, setFlash] = useState<FlashMessage | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  const cleanUrl = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('notice')
    params.delete('error')
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }, [pathname, searchParams])

  useEffect(() => {
    if (pathname !== '/me/council') return

    const notice = searchParams.get('notice')?.trim()
    const error = searchParams.get('error')?.trim()
    const queryFlash: FlashMessage | null = notice
      ? { kind: 'notice', message: notice }
      : error
        ? { kind: 'error', message: error }
        : null
    const cookieFlash = readFlashCookie()
    const nextFlash = cookieFlash ?? queryFlash

    if (searchParams.has('notice') || searchParams.has('error')) {
      router.replace(cleanUrl, { scroll: false })
    }

    clearFlashCookie()

    if (nextFlash) {
      setFlash(nextFlash)
      setIsVisible(true)
    }
  }, [cleanUrl, pathname, router, searchParams])

  useEffect(() => {
    if (!isVisible) return

    const dismiss = () => setIsVisible(false)
    const timeoutId = window.setTimeout(dismiss, 4000)
    const listenerTimeoutId = window.setTimeout(() => {
      document.addEventListener('pointerdown', dismiss, { once: true })
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearTimeout(listenerTimeoutId)
      document.removeEventListener('pointerdown', dismiss)
    }
  }, [isVisible, flash?.message])

  if (pathname !== '/me/council' || !isVisible || !flash) return null

  if (flash.kind === 'error') {
    return (
      <section className="qv-card qv-error" role="alert" style={{ marginTop: 18 }}>
        <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{flash.message}</p>
      </section>
    )
  }

  return (
    <section
      className="qv-card"
      aria-live="polite"
      style={{
        borderColor: 'var(--divider-strong)',
        marginTop: 18,
        color: 'var(--text-primary)',
      }}
    >
      <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{flash.message}</p>
    </section>
  )
}
