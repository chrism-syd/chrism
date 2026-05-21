'use client'

type CardArtProps = {
  title: string
  imageUrl: string | null
  size?: 'large' | 'small'
}

export default function CardArt({ title, imageUrl, size = 'large' }: CardArtProps) {
  if (!imageUrl) {
    return (
      <div className={`ccic-card-art ccic-card-art-${size} is-placeholder`} aria-label={`${title} artwork placeholder`}>
        <span>Card image coming soon</span>
      </div>
    )
  }

  return (
    <div className={`ccic-card-art ccic-card-art-${size}`}>
      <img src={imageUrl} alt={`${title} card front`} loading="lazy" />
    </div>
  )
}
