import Image from 'next/image'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { hasSharedCustomListsForUser } from '@/lib/custom-lists'
import { getPublicMeetingsHref, listMemberInvitedEvents } from '@/lib/member-navigation'
import UserMenu from './components/user-menu'
import PrimaryNav from './components/primary-nav'
import AccessContextSwitcher from './components/access-context-switcher'
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
    ...(permissions.canManageCustomLists ? [{ label: 'Custom lists', href: '/custom-lists' }] : []),
    ...(permissions.canReviewMemberChanges ? [{ label: 'Reviews', href: '/members/reviews' }] : []),
    ...(permissions.canImportMembers ? [{ label: 'Imports', href: '/imports/supreme' }] : []),
  ]

  const navItems = permissions.hasStaffAccess
    ? [
        {
          label: 'Members',
          href: '/members',
          items: staffMembersChildren.length > 1 ? staffMembersChildren : undefined,
        },
        ...(permissions.canManageEvents ? [{ label: 'Events', href: '/events' }] : []),
      ]
    : [
        { label: 'Profile', href: '/me' },
        ...(hasSharedCustomLists ? [{ label: 'Custom lists', href: '/custom-lists' }] : []),
        ...(memberInvitedEvents.length > 0 ? [{ label: 'Events', href: '/events' }] : []),
        ...(publicMeetingsHref ? [{ label: 'Public meetings', href: publicMeetingsHref }] : []),
      ]

  const showAccessContextSwitcher = permissions.isSignedIn && !permissions.isDevMode
  const showSectionToggle = permissions.isSignedIn && permissions.hasStaffAccess && !permissions.isDevMode
  const activeSection = permissions.hasStaffAccess ? 'operations' : 'spiritual'

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
        {showAccessContextSwitcher && permissions.availableContexts.length > 1 ? (
          <AccessContextSwitcher
            contexts={permissions.availableContexts}
            selectedContextKey={permissions.activeContextKey}
          />
        ) : null}

        {showSectionToggle ? (
          <div className="qv-dev-header-flags">
            <Link
              href="/spiritual"
              className={activeSection === 'spiritual' ? 'qv-mini-pill qv-mini-pill-accent' : 'qv-mini-pill'}
            >
              Spiritual
            </Link>
            <Link
              href="/"
              className={activeSection === 'operations' ? 'qv-mini-pill qv-mini-pill-accent' : 'qv-mini-pill'}
            >
              Operations
            </Link>
          </div>
        ) : null}

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
              ...(permissions.canAccessOrganizationSettings ? [{ href: '/me/council', label: 'Organization settings' }] : []),
              ...(permissions.canAccessOfficerDirectory ? [{ href: '/members/officers', label: 'Officers' }] : []),
              ...(permissions.isSuperAdmin ? [{ href: '/super-admin/organization-claims', label: 'Claim queue' }] : []),
            ]}
            email={permissions.email}
            currentViewLabel={permissions.isDevMode ? permissions.currentViewLabel : null}
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
