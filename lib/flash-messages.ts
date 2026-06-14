import { cookies } from 'next/headers'

export const FLASH_MESSAGE_COOKIE = 'chrism_flash_message'

export type FlashMessageKind = 'notice' | 'error'

export type FlashMessage = {
  kind: FlashMessageKind
  message: string
}

function normalizeFlashMessage(message: string | null | undefined) {
  const trimmed = message?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

export async function setFlashMessage(kind: FlashMessageKind, message: string | null | undefined) {
  const normalizedMessage = normalizeFlashMessage(message)
  if (!normalizedMessage) return

  const cookieStore = await cookies()
  cookieStore.set(FLASH_MESSAGE_COOKIE, encodeURIComponent(JSON.stringify({
    kind,
    message: normalizedMessage,
  } satisfies FlashMessage)), {
    maxAge: 60,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function getFlashMessage() {
  const cookieStore = await cookies()
  const value = cookieStore.get(FLASH_MESSAGE_COOKIE)?.value
  if (!value) return null

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<FlashMessage>
    if ((parsed.kind === 'notice' || parsed.kind === 'error') && typeof parsed.message === 'string') {
      const message = normalizeFlashMessage(parsed.message)
      return message ? { kind: parsed.kind, message } : null
    }
  } catch {
    return null
  }

  return null
}
