import Image from 'next/image'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserPermissions, type CurrentUserPermissions } from '@/lib/auth/permissions'
import { hasExplicitlySharedCustomListsForUser } from '@/lib/custom-lists'
import { getPublicMeetingsHref, listMemberInvitedEvents } from '@/lib/member-navigation'
import UserMenu from './components/user-menu'
import PrimaryNav from './components/primary-nav'
import ModeSwitcher from './components/mode-switcher'
import type { SuperAdminOrganizationOption } from './components/dev-mode-switcher'

type OrganizationRow = {
  id: string
  display_name: string | null
  preferred_name: string | null
}

type AppHeaderProps = {
  brandVariant?: 'auto' | 'operations' | 'spiritual'
  permissions?: CurrentUserPermissions | null
}

export default async function AppHeader({ brandVariant = 'auto', permissions: providedPermissions }: AppHeaderProps) {
  const permissions = providedPermissions ?? await getCurrentUserPermissions()
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

  const suppressPersonalizedMemberLinks =
    permissions.isSuperAdmin && permissions.actingMode === 'member'

  let memberInvitedEvents: Awaited<ReturnType<typeof listMemberInvitedEvents>> = []
  let publicMeetingsHref: string | null = null
  let hasSharedCustomLists = false

  if (permissions.isSignedIn && !permissions.hasStaffAccess) {
    const [memberInvitedEventsResult, publicMeetingsHrefResult, hasSharedCustomListsResult] = suppressPersonalizedMemberLinks
      ? [
          { status: 'fulfilled', value: [] as Awaited<ReturnType<typeof listMemberInvitedEvents>> } as const,
          { status: 'fulfilled', value: null as string | null } as const,
          { status: 'fulfilled', value: false } as const,
        ]
      : await Promise.allSettled([
          listMemberInvitedEvents({ admin, permissions, limit: 6 }),
          getPublicMeetingsHref({ admin, councilId: permissions.councilId }),
          hasExplicitlySharedCustomListsForUser({ admin, permissions }),
        ])

    if (memberInvitedEventsResult.status === 'fulfilled') {
      memberInvitedEvents = memberInvitedEventsResult.value
    }

    if (publicMeetingsHrefResult.status === 'fulfilled') {
      publicMeetingsHref = publicMeetingsHrefResult.value
    }

    if (hasSharedCustomListsResult.status === 'fulfilled') {
      hasSharedCustomLists = hasSharedCustomListsResult.value
    }
  }

  const memberNavChildren = [
    ...(permissions.canAccessMemberData ? [{ label: 'Member directory', href: '/members' }] : []),
    ...(permissions.canManageCustomLists ? [{ label: 'Custom lists', href: '/custom-lists' }] : []),
    ...(permissions.canReviewMemberChanges ? [{ label: 'Reviews', href: '/members/reviews' }] : []),
    ...(permissions.canImportMembers ? [{ label: 'Imports', href: '/imports/supreme' }] : []),
  ]

  const navItems = permissions.hasStaffAccess
    ? [
        ...(memberNavChildren.length > 0
          ? [{
              label: 'Members',
              href: memberNavChildren[0]?.href ?? '/members',
              items: memberNavChildren.length > 1 ? memberNavChildren : undefined,
            }]
          : []),
        ...(!permissions.canAccessMemberData && permissions.canManageCustomLists
          ? [{ label: 'Custom lists', href: '/custom-lists' }]
          : []),
        ...(permissions.canManageEvents ? [{ label: 'Events', href: '/events' }] : []),
      ]
    : [
        { label: 'Profile', href: '/me' },
        ...(hasSharedCustomLists ? [{ label: 'Custom lists', href: '/custom-lists' }] : []),
        ...(memberInvitedEvents.length > 0 ? [{ label: 'Events', href: '/events' }] : []),
        ...(publicMeetingsHref ? [{ label: 'Public meetings', href: publicMeetingsHref }] : []),
      ]

  const logoSrc =
    brandVariant === 'spiritual'
      ? '/Chrism_horiz.svg'
      : brandVariant === 'operations'
        ? '/Chrism-ops.svg'
        : permissions.hasStaffAccess
          ? '/Chrism-ops.svg'
          : '/Chrism_horiz.svg'

  return (
    <header className="qv-app-header">
      <div className="qv-app-header-left">
        <Link href="/" className="qv-brand">
          <Image
            src={logoSrc}
            alt="Chrism"
            width={280}
            height={94}
            className="qv-brand-logo"
            priority
          />
        </Link>

        {permissions.isSignedIn && navItems.length > 0 ? <PrimaryNav items={navItems} /> : null}

        {permissions.isSignedIn && permissions.hasStaffAccess ? (
          <ModeSwitcher operationsHref="/" spiritualHref="/spiritual" />
        ) : null}
      </div>

      <div className="qv-app-header-right">
        {permissions.isDevMode && permissions.currentViewLabel ? (
          <span className="qv-mini-pill">{permissions.currentViewLabel}</span>
        ) : null}

        {permissions.isSignedIn ? (
          <UserMenu
            links={[
              { href: '/me', label: 'Profile' },
              ...(permissions.hasStaffAccess && permissions.canManageCustomLists && !memberNavChildren.some((item) => item.href === '/custom-lists')
                ? [{ href: '/custom-lists', label: 'Custom lists' }]
                : []),
              ...(permissions.canAccessOrganizationSettings || permissions.canManageAdmins
                ? [{ href: '/me/council', label: 'Organization settings' }]
                : []),
              ...(permissions.canAccessOfficerDirectory ? [{ href: '/members/officers', label: 'Officers' }] : []),
            ]}
            email={permissions.email}
            accessContext={{
              selectedContextKey: permissions.activeContextKey,
              contexts: permissions.availableContexts,
            }}
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
