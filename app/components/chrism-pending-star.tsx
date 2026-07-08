/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useRef } from 'react'

type ChrismPendingStarProps = {
  size?: number
  className?: string
}

export default function ChrismPendingStar({ size = 16, className }: ChrismPendingStarProps) {
  const starRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!starRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const animation = starRef.current.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: 900, iterations: Infinity }
    )

    return () => animation.cancel()
  }, [])

  return (
    <img
      ref={starRef}
      src="/chrism_star.png"
      alt=""
      aria-hidden="true"
      className={className}
      style={{
        display: 'block',
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
      }}
    />
  )
}
