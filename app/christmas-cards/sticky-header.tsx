'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

export default function StickyHeader({ brandName }: { brandName: string }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const target = document.getElementById('ccic-hero-logo-anchor')
    if (!target) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0)
      },
      { threshold: 0 }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  return (
    <header className={`ccic-sticky-header ${isVisible ? 'is-visible' : ''}`} aria-label={`${brandName} page header`}>
      <div className="ccic-sticky-header-inner">
        <Image src="/CCiC.png" alt={brandName} width={72} height={72} className="ccic-sticky-logo" />
        <span>Christmas card ordering</span>
      </div>
    </header>
  )
}
