'use client'

import { useEffect } from 'react'

const FLASH_MESSAGE_COOKIE = 'chrism_flash_message'

export default function ClearFlashMessageCookie() {
  useEffect(() => {
    document.cookie = FLASH_MESSAGE_COOKIE + '=; Max-Age=0; path=/; SameSite=Lax'
  }, [])

  return null
}
