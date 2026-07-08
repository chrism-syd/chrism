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

function getActiveChildHref(pathname: string, items: NavItem['items']) {
  const matches = (items ?? [])
    .filter((item) => isHrefActive(pathname, item.href))
    .sort((left, right) => right.href.length - left.href.length)

  return matches[0]?.href ?? null
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

  const visibleItems = items.filter((item) => !(item.href === '/spiritual' && isHrefActive(pathname, '/spiritual')))

  return (
    <nav className="qv-nav" aria-label="Primary" ref={navRef}>
      {visibleItems.map((item) => {
        const activeChildHref = getActiveChildHref(pathname, item.items)
        const isActive = item.items
          ? Boolean(activeChildHref) || isHrefActive(pathname, item.href)
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
              <span
                className="qv-nav-dropdown-chevron"
                aria-hidden="true"
                data-open={isOpen ? 'true' : 'false'}
              >
                <svg viewBox="0 0 20 20" className="qv-nav-dropdown-chevron-icon">
                  <path
                    d="M5.25 7.5 10 12.25 14.75 7.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>

            {isOpen ? (
              <div className="qv-nav-submenu" role="menu">
                {item.items.map((child) => {
                  const isChildActive = activeChildHref === child.href
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
