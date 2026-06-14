'use client'

import { useEffect, useState } from 'react'

const FLASH_MESSAGE_COOKIE = 'chrism_flash_message'
const MESSAGE_QUERY_KEYS = ['notice', 'error'] as const

type FlashMessage = {
  kind: 'notice' | 'error'
  message: string
}

function getCookieValue(name: string) {
  const parts = document.cookie.split(';')

  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.slice(name.length + 1))
    }
  }

  return null
}

function getFlashMessage() {
  const value = getCookieValue(FLASH_MESSAGE_COOKIE)
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<FlashMessage>
    if ((parsed.kind === 'notice' || parsed.kind === 'error') && typeof parsed.message === 'string') {
      const message = parsed.message.trim()
      return message ? { kind: parsed.kind, message } : null
    }
  } catch {
    return null
  }

  return null
}

function clearFlashMessage() {
  document.cookie = `${FLASH_MESSAGE_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`
}

function cleanMessageParams() {
  const currentUrl = new URL(window.location.href)
  let changed = false

  for (const key of MESSAGE_QUERY_KEYS) {
    if (currentUrl.searchParams.has(key)) {
      currentUrl.searchParams.delete(key)
      changed = true
    }
  }

  if (!changed) return

  const query = currentUrl.searchParams.toString()
  const cleanUrl = `${currentUrl.pathname}${query ? `?${query}` : ''}${currentUrl.hash}`
  window.history.replaceState(window.history.state, '', cleanUrl)
}

export default function CleanQueryMessageParams() {
  const [flash, setFlash] = useState<FlashMessage | null>(null)

  useEffect(() => {
    const message = getFlashMessage()
    cleanMessageParams()
    clearFlashMessage()
    setFlash(message)
  }, [])

  useEffect(() => {
    if (!flash) return

    const dismiss = () => setFlash(null)
    const timeoutId = window.setTimeout(dismiss, 5000)
    const listenerId = window.setTimeout(() => {
      document.addEventListener('pointerdown', dismiss, { once: true })
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearTimeout(listenerId)
      document.removeEventListener('pointerdown', dismiss)
    }
  }, [flash])

  if (!flash) return null

  return (
    <div
      aria-live={flash.kind === 'error' ? 'assertive' : 'polite'}
      style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 1000, maxWidth: 'min(420px, calc(100vw - 36px))' }}
    >
      <div className={flash.kind === 'error' ? 'qv-card qv-error' : 'qv-card'} style={{ boxShadow: 'var(--shadow-soft)' }}>
        <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{flash.message}</p>
      </div>
    </div>
  )
}
