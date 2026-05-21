'use client'

import Image from 'next/image'
import { useState } from 'react'

type CardArtProps = {
  title: string
  imageUrl: string | null
  size?: 'large' | 'small'
}

export default function CardArt({ title, imageUrl, size = 'large' }: CardArtProps) {
  const [failed, setFailed] = useState(false)

  if (!imageUrl || failed) {
    return (
      <div className={`ccic-card-art ccic-card-art-${size} is-placeholder`} aria-label={`${title} artwork placeholder`}>
        <span>Card image coming soon</span>
      </div>
    )
  }

  return (
    <div className={`ccic-card-art ccic-card-art-${size}`}>
      <Image
        src={imageUrl}
        alt={`${title} card front`}
        fill
        sizes={size === 'small' ? '120px' : '(max-width: 640px) 100vw, 280px'}
        onError={() => setFailed(true)}
      />
    </div>
  )
}
