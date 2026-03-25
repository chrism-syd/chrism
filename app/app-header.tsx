import Image from 'next/image'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { hasSharedCustomListsForUser } from '@/lib/custom-lists'
import { getPublicMeetingsHref, listMemberInvitedEvents } from '@/lib/member-navigation'
import UserMenu from './components/user-menu'
import PrimaryNav from './components/primary-nav'
import type { SuperAdminOrganizationOption } from './components/dev-mode-switcher'

type OrganizationRow = {
  id: string
  display_name: string | null
  preferred_name: string | null
}

export default async function AppHeader() {
  const permissions = await getCurrentUserPermissions()
  const admin = createAdminClient()

  let devOrganizations: SuperAdminOrganizationOption[] = []
  if (permissions.isSuperAdmin) {
    const { data: organizationsData } = await admin
      .from('organizations')
      .select('id, display_name, preferred_name')
      .order('display_name', { ascending: true })

    devOrganizations = (((organizationsData as OrganizationRow[] | null) ?? []).map((organization) => ({
      id: organization.id,
      name: organization.preferred_name?.trim() || organization.display_name?.trim() || 'Organization',
    })))
  }

  const [memberInvitedEvents, publicMeetingsHref, hasSharedCustomLists] =
    permissions.isSignedIn && !permissions.hasStaffAccess
      ? await Promise.all([
          listMemberInvitedEvents({ admin, permissions, limit: 6 }),
          getPublicMeetingsHref({ admin, councilId: permissions.councilId }),
          hasSharedCustomListsForUser({ admin, permissions }),
        ])
      : [[], null, false]

  const staffMembersChildren = [
    { label: 'Member directory', href: '/members' },
    ...(permissions.isCouncilAdmin ? [{ label: 'Custom lists', href: '/custom-lists' }] : []),
    ...(permissions.isCouncilAdmin ? [{ label: 'Reviews', href: '/members/reviews' }] : []),
    ...(permissions.isCouncilAdmin ? [{ label: 'Imports', href: '/imports/supreme' }] : []),
  ]

  const navItems = permissions.hasStaffAccess
    ? [
        {
          label: 'Members',
          href: '/members',
          items: staffMembersChildren.length > 1 ? staffMembersChildren : undefined,
        },
        { label: 'Events', href: '/events' },
      ]
    : [
        { label: 'Profile', href: '/me' },
        ...(hasSharedCustomLists ? [{ label: 'Custom lists', href: '/custom-lists' }] : []),
        ...(memberInvitedEvents.length > 0 ? [{ label: 'Events', href: '/events' }] : []),
        ...(publicMeetingsHref ? [{ label: 'Public meetings', href: publicMeetingsHref }] : []),
      ]

  return (
    <header className="qv-app-header">
      <div className="qv-app-header-left">
        <Link href="/" className="qv-brand">
          <Image
            src={permissions.hasStaffAccess ? '/Chrism-ops.svg' : '/Chrism_horiz.svg'}
            alt="Chrism"
            width={240}
            height={80}
            className="qv-brand-logo"
            priority
          />
        </Link>

        {permissions.isSignedIn ? <PrimaryNav items={navItems} /> : null}
      </div>

      <div className="qv-app-header-right">
        {permissions.isDevMode ? (
          <div className="qv-dev-header-flags">
            <span className="qv-mini-pill qv-mini-pill-accent">Dev mode</span>
            {permissions.currentViewLabel ? <span className="qv-mini-pill">{permissions.currentViewLabel}</span> : null}
          </div>
        ) : null}

        {permissions.isSignedIn ? (
          <UserMenu
            links={[
              { href: '/me', label: 'Profile' },
              ...(permissions.isCouncilAdmin ? [{ href: '/me/council', label: 'Organization settings' }] : []),
              ...(!permissions.isCouncilAdmin && permissions.organizationId ? [{ href: '/me/claim-organization', label: 'Claim admin access' }] : []),
              ...(permissions.hasStaffAccess ? [{ href: '/members/officers', label: 'Officers' }] : []),
              ...(permissions.isSuperAdmin ? [{ href: '/super-admin/organization-claims', label: 'Claim queue' }] : []),
            ]}
            email={permissions.email}
            devMode={
              permissions.isSuperAdmin
                ? {
                    selectedMode: permissions.actingMode,
                    selectedOrganizationId: permissions.organizationId,
                    organizations: devOrganizations,
                  }
                : null
            }
          />
        ) : null}
      </div>
    </header>
  )
}
