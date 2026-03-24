'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import SignOutButton from '@/app/sign-out-button'
import DevModeSwitcher, { type SuperAdminOrganizationOption } from '@/app/components/dev-mode-switcher'

type UserMenuLink = {
  href: string
  label: string
}

type UserMenuProps = {
  links: UserMenuLink[]
  email?: string | null
  devMode?: {
    selectedMode: 'normal' | 'admin' | 'member'
    selectedOrganizationId: string | null
    organizations: SuperAdminOrganizationOption[]
  } | null
}

export default function UserMenu({ links, email, devMode }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="qv-user-menu">
      <button type="button" className="qv-user-menu-trigger" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((current) => !current)}>
        <span aria-hidden="true">☰</span>
        <span className="qv-user-menu-label">Menu</span>
      </button>

      {open ? (
        <div className="qv-user-menu-panel" role="menu">
          {email ? <p className="qv-user-menu-email">{email}</p> : null}

          {links.map((link) => (
            <Link key={`${link.label}-${link.href}`} href={link.href} className="qv-user-menu-link" role="menuitem" onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}

          {devMode ? (
            <>
              <div className="qv-user-menu-divider" />
              <DevModeSwitcher organizations={devMode.organizations} selectedOrganizationId={devMode.selectedOrganizationId} selectedMode={devMode.selectedMode} />
            </>
          ) : null}

          <div className="qv-user-menu-divider" />
          <SignOutButton compact />
        </div>
      ) : null}
    </div>
  )
}
