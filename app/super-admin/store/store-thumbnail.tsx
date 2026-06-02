'use client'

import Image from 'next/image'
import { useState } from 'react'

type Props = {
  src: string | null
  alt: string
  className: string
}

export default function StoreThumbnail({ src, alt, className }: Props) {
  const [hasImageError, setHasImageError] = useState(false)

  if (!src?.startsWith('/') || hasImageError) {
    return <div className={`${className} ccic-admin-case-thumbnail-empty`} aria-hidden="true" />
  }

  return (
    <div className={className}>
      <Image src={src} alt={alt} width={120} height={150} onError={() => setHasImageError(true)} />
    </div>
  )
}
