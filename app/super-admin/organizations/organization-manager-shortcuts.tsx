'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function OrganizationManagerShortcuts() {
  const pathname = usePathname()
  if (pathname !== '/super-admin/organizations') return null

  return (
    <div className="qv-page" style={{ paddingBottom: 0 }}>
      <div className="qv-shell" style={{ paddingBottom: 0 }}>
        <section className="qv-card" style={{ marginBottom: 18 }}>
          <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
            <Link href="/super-admin/organizations/annual-term" className="qv-link-button qv-button-primary">
              Parent annual terms
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
