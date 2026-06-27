'use client'

import { useEffect } from 'react'

const PLACEHOLDER_REPLACEMENTS: Record<string, string> = {
  'St. Patrick’s Parish': 'Meeting location or community hall',
  '5633 Highway 7': '123 Main Street',
  Markham: 'Your City',
  Ontario: 'Province / State',
  'L3P 1B6': 'A1A 1A1',
}

export default function NeutralContactPlaceholders() {
  useEffect(() => {
    for (const input of Array.from(document.querySelectorAll<HTMLInputElement>('input[placeholder]'))) {
      const replacement = PLACEHOLDER_REPLACEMENTS[input.placeholder]
      if (replacement) input.placeholder = replacement
    }
  }, [])

  return null
}
