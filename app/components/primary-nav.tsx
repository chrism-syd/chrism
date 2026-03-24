'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

type NavItem = {
  label: string
  href: string
  items?: Array<{
    label: string
    href: string
  }>
}

type Props = {
  items: NavItem[]
}

function isHrefActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function PrimaryNav({ items }: Props) {
  const pathname = usePathname()
  const [openLabel, setOpenLabel] = useState<string | null>(null)
  const navRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!navRef.current?.contains(event.target as Node)) {
        setOpenLabel(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  return (
    <nav className="qv-nav" aria-label="Primary" ref={navRef}>
      {items.map((item) => {
        const isActive = item.items
          ? item.items.some((child) => isHrefActive(pathname, child.href)) || isHrefActive(pathname, item.href)
          : isHrefActive(pathname, item.href)

        if (!item.items?.length) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="qv-nav-link"
              aria-current={isActive ? 'page' : undefined}
            >
              {item.label}
            </Link>
          )
        }

        const isOpen = openLabel === item.label

        return (
          <div key={item.label} className="qv-nav-dropdown">
            <button
              type="button"
              className="qv-nav-dropdown-trigger"
              aria-expanded={isOpen}
              aria-haspopup="menu"
              data-active={isActive ? 'true' : 'false'}
              onClick={() => setOpenLabel((current) => (current === item.label ? null : item.label))}
            >
              <span>{item.label}</span>
              <span className="qv-nav-dropdown-chevron" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
            </button>

            {isOpen ? (
              <div className="qv-nav-submenu" role="menu">
                {item.items.map((child) => {
                  const isChildActive = isHrefActive(pathname, child.href)
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      role="menuitem"
                      className="qv-nav-submenu-link"
                      aria-current={isChildActive ? 'page' : undefined}
                      onClick={() => setOpenLabel(null)}
                    >
                      {child.label}
                    </Link>
                  )
                })}
              </div>
            ) : null}
          </div>
        )
      })}
    </nav>
  )
}
