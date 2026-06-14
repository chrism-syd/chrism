'use client'

import { useEffect, useState } from 'react'

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

function readQueryFlash(currentUrl: URL): FlashMessage | null {
  const notice = currentUrl.searchParams.get('notice')?.trim()
  if (notice) {
    return { kind: 'notice', message: notice }
  }

  const error = currentUrl.searchParams.get('error')?.trim()
  if (error) {
    return { kind: 'error', message: error }
  }

  return null
}

function cleanMessageQueryParams(currentUrl: URL) {
  const nextUrl = new URL(currentUrl)
  nextUrl.searchParams.delete('notice')
  nextUrl.searchParams.delete('error')

  const nextSearch = nextUrl.searchParams.toString()
  return `${nextUrl.pathname}${nextSearch ? `?${nextSearch}` : ''}${nextUrl.hash}`
}

export default function CouncilSettingsFlashMessage() {
  const [flash, setFlash] = useState<FlashMessage | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const currentUrl = new URL(window.location.href)
    if (currentUrl.pathname !== '/me/council') return

    const queryFlash = readQueryFlash(currentUrl)
    const cookieFlash = readFlashCookie()
    const nextFlash = cookieFlash ?? queryFlash

    if (currentUrl.searchParams.has('notice') || currentUrl.searchParams.has('error')) {
      window.history.replaceState(window.history.state, '', cleanMessageQueryParams(currentUrl))
    }

    clearFlashCookie()

    if (nextFlash) {
      setFlash(nextFlash)
      setIsVisible(true)
    }
  }, [])

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

  if (!isVisible || !flash) return null

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
