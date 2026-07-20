'use client'

import { useEffect } from 'react'

export default function BusinessMotionObserver() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-motion]'))

    if (!targets.length) {
      return
    }

    if (!('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('motion-in'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('motion-in')
            observer.unobserve(entry.target)
          }
        })
      },
      {
        rootMargin: '0px 0px -14% 0px',
        threshold: 0.16,
      }
    )

    targets.forEach((target) => observer.observe(target))

    return () => observer.disconnect()
  }, [])

  return null
}
