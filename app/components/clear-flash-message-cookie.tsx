'use client'

import { useEffect } from 'react'
import { FLASH_MESSAGE_COOKIE } from '@/lib/flash-message-constants'

function clearFlashCookie() {
  const expires = 'Thu, 01 Jan 1970 00:00:00 GMT'
  document.cookie = FLASH_MESSAGE_COOKIE + '=; expires=' + expires + '; path=/; SameSite=Lax'
}

export default function ClearFlashMessageCookie() {
  useEffect(() => {
    clearFlashCookie()
  }, [])

  return null
}
