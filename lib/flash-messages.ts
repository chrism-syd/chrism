import { cookies } from 'next/headers'
import { FLASH_MESSAGE_COOKIE } from '@/lib/flash-message-constants'

export type FlashMessageKind = 'notice' | 'error'

export type FlashMessage = {
  kind: FlashMessageKind
  message: string
  path?: string | null
}

function normalizeFlashMessage(message: string | null | undefined) {
  const trimmed = message?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

function normalizeFlashMessagePath(path: string | null | undefined) {
  const trimmed = path?.trim() ?? ''
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//')) return null
  return trimmed.split('?')[0]?.split('#')[0] ?? trimmed
}

async function readFlashMessageCookie() {
  const cookieStore = await cookies()
  const value = cookieStore.get(FLASH_MESSAGE_COOKIE)?.value
  if (!value) return null

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<FlashMessage>
    if ((parsed.kind === 'notice' || parsed.kind === 'error') && typeof parsed.message === 'string') {
      const message = normalizeFlashMessage(parsed.message)
      return message
        ? {
            kind: parsed.kind,
            message,
            path: normalizeFlashMessagePath(parsed.path),
          }
        : null
    }
  } catch {
    return null
  }

  return null
}

export async function setFlashMessage(kind: FlashMessageKind, message: string | null | undefined, path?: string | null) {
  const normalizedMessage = normalizeFlashMessage(message)
  if (!normalizedMessage) return

  const cookieStore = await cookies()
  cookieStore.set(FLASH_MESSAGE_COOKIE, encodeURIComponent(JSON.stringify({
    kind,
    message: normalizedMessage,
    path: normalizeFlashMessagePath(path),
  } satisfies FlashMessage)), {
    maxAge: 60,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function getFlashMessage() {
  return readFlashMessageCookie()
}

export async function consumeFlashMessage(path: string) {
  const flashMessage = await readFlashMessageCookie()
  if (!flashMessage) return null

  const normalizedPath = normalizeFlashMessagePath(path)
  if (flashMessage.path && normalizedPath && flashMessage.path !== normalizedPath) {
    return null
  }

  return flashMessage
}
