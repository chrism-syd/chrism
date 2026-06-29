import type { CSSProperties } from 'react'
import styles from './portrait-frame.module.css'

export type PortraitFrameImage = {
  src: string | null
  alt: string
  zoom?: number | null
  positionX?: number | null
  positionY?: number | null
}

type PortraitFrameProps = {
  image: PortraitFrameImage
  size?: number
  radius?: number
  placeholderLabel?: string
  className?: string
}

function clampNumber(value: number | null | undefined, minimum: number, maximum: number, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(maximum, Math.max(minimum, value))
}

export default function PortraitFrame({
  image,
  size = 160,
  radius = 24,
  placeholderLabel = 'Portrait coming soon',
  className,
}: PortraitFrameProps) {
  const zoom = clampNumber(image.zoom, 1, 3, 1)
  const positionX = clampNumber(image.positionX, 0, 100, 50)
  const positionY = clampNumber(image.positionY, 0, 100, 50)
  const style = {
    '--portrait-size': `${size}px`,
    '--portrait-radius': `${radius}px`,
    '--portrait-zoom': String(zoom),
    '--portrait-position-x': `${positionX}%`,
    '--portrait-position-y': `${positionY}%`,
  } as CSSProperties
  const classNames = [styles.frame, className].filter(Boolean).join(' ')

  return (
    <div className={classNames} style={style}>
      {image.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed private storage URLs are already sized by the fixed portrait frame.
        <img className={styles.image} src={image.src} alt={image.alt} />
      ) : (
        <div className={styles.placeholder} aria-label={placeholderLabel}>
          <div className={styles.placeholderMark} aria-hidden="true">✦</div>
          <p className={styles.placeholderText}>{placeholderLabel}</p>
        </div>
      )}
    </div>
  )
}
