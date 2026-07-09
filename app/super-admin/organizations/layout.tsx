import type { ReactNode } from 'react'
import OrganizationManagerShortcuts from './organization-manager-shortcuts'

export default function SuperAdminOrganizationsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <OrganizationManagerShortcuts />
      {children}
    </>
  )
}
