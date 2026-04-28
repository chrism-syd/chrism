'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import SignOutButton from '@/app/sign-out-button'
import DevModeSwitcher, { type SuperAdminOrganizationOption } from '@/app/components/dev-mode-switcher'
import AccessContextSwitcher from '@/app/components/access-context-switcher'
import OperationsScopeSwitcher from '@/app/components/operations-scope-switcher'
import type { AccessContextOption } from '@/lib/auth/access-contexts'

type UserMenuLink = {
  href: string
  label: string
}

type UserMenuProps = {
  links: UserMenuLink[]
  email?: string | null
  accessContext?: {
    selectedContextKey: string | null
    contexts: AccessContextOption[]
  } | null
  devMode?: {
    selectedMode: 'normal' | 'admin' | 'member'
    selectedOrganizationId: string | null
    organizations: SuperAdminOrganizationOption[]
  } | null
  operationsScopeSwitcher?: {
    members?: boolean
    events?: boolean
    custom_lists?: boolean
    local_unit_settings?: boolean
  } | null
}

export default function UserMenu({ links, email, accessContext, devMode, operationsScopeSwitcher }: UserMenuProps) {
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

          {operationsScopeSwitcher ? <OperationsScopeSwitcher switchableAreas={operationsScopeSwitcher} /> : null}

          {accessContext && accessContext.contexts.length > 1 ? (
            <>
              <div className="qv-user-menu-divider" />
              <AccessContextSwitcher
                contexts={accessContext.contexts}
                selectedContextKey={accessContext.selectedContextKey}
              />
            </>
          ) : null}

          {devMode ? (
            <>
              <div className="qv-user-menu-divider" />
              <DevModeSwitcher
                organizations={devMode.organizations}
                selectedOrganizationId={devMode.selectedOrganizationId}
                selectedMode={devMode.selectedMode}
              />
            </>
          ) : null}

          <div className="qv-user-menu-divider" />
          <SignOutButton compact />
        </div>
      ) : null}
    </div>
  )
}
