import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import OrganizationAvatar from '@/app/components/organization-avatar'
import {
  listAccessibleLocalUnitsForArea,
  type ManagedAreaAccessLevel,
  type ManagedAreaCode,
} from '@/lib/auth/area-access'
import {
  getSelectedOperationsLocalUnitId,
  OPERATIONS_SCOPE_COOKIE,
} from '@/lib/auth/operations-scope-selection'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import styles from './home.module.css'

type CouncilRow = {
  id: string
  name: string | null
  council_number: string | null
  organization_id: string | null
}

type LocalUnitRow = {
  id: string
  display_name: string | null
  legacy_council_id: string | null
  legacy_organization_id?: string | null
  local_unit_kind?: string | null
}

type OrganizationRow = {
  display_name: string | null
  preferred_name: string | null
  logo_storage_path: string | null
  logo_alt_text: string | null
  brand_profile?: {
    code: string | null
    display_name: string | null
    logo_storage_bucket: string | null
    logo_storage_path: string | null
    logo_alt_text: string | null
  } | null
} | null

type HomeScopeOption = {
  local_unit_id: string
  local_unit_name: string
  areaCode: ManagedAreaCode
  minimumAccessLevel: ManagedAreaAccessLevel
}

const HOME_SCOPE_RULES: Array<{
  areaCode: ManagedAreaCode
  minimumAccessLevel: ManagedAreaAccessLevel
}> = [
  { areaCode: 'members', minimumAccessLevel: 'edit_manage' },
  { areaCode: 'events', minimumAccessLevel: 'manage' },
  { areaCode: 'custom_lists', minimumAccessLevel: 'manage' },
  { areaCode: 'local_unit_settings', minimumAccessLevel: 'manage' },
  { areaCode: 'admins', minimumAccessLevel: 'manage' },
  { areaCode: 'claims', minimumAccessLevel: 'manage' },
]

async function loadOrganizationProfile(args: {
  admin: ReturnType<typeof createAdminClient>
  council: CouncilRow
}) {
  const { admin, council } = args

  if (!council.organization_id) {
    return null
  }

  const { data } = await admin
    .from('organizations')
    .select(
      'display_name, preferred_name, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)'
    )
    .eq('id', council.organization_id)
    .maybeSingle()

  return (data as OrganizationRow) ?? null
}

async function listHomeAccessibleLocalUnits(args: {
  admin: ReturnType<typeof createAdminClient>
  userId: string
}) {
  const results = await Promise.all(
    HOME_SCOPE_RULES.map(async (rule) => ({
      rule,
      units: await listAccessibleLocalUnitsForArea({
        admin: args.admin,
        userId: args.userId,
        areaCode: rule.areaCode,
        minimumAccessLevel: rule.minimumAccessLevel,
      }).catch(() => []),
    }))
  )

  const byId = new Map<string, HomeScopeOption>()

  for (const result of results) {
    for (const unit of result.units) {
      if (byId.has(unit.local_unit_id)) {
        continue
      }

      byId.set(unit.local_unit_id, {
        local_unit_id: unit.local_unit_id,
        local_unit_name: unit.local_unit_name,
        areaCode: result.rule.areaCode,
        minimumAccessLevel: result.rule.minimumAccessLevel,
      })
    }
  }

  return [...byId.values()].sort((left, right) => left.local_unit_name.localeCompare(right.local_unit_name))
}

async function resolveHomeContext(args: {
  admin: ReturnType<typeof createAdminClient>
  permissions: Awaited<ReturnType<typeof getCurrentUserPermissions>>
}) {
  const empty = {
    council: null as CouncilRow | null,
    currentLocalUnit: null as LocalUnitRow | null,
    switchableLocalUnits: [] as HomeScopeOption[],
  }

  if (!args.permissions.authUser) {
    return empty
  }

  if (args.permissions.isSuperAdmin && args.permissions.actingMode !== 'normal') {
    let activeLocalUnitId = args.permissions.activeLocalUnitId

    if (!activeLocalUnitId && args.permissions.councilId) {
      const { data } = await args.admin
        .from('local_units')
        .select('id, display_name, legacy_council_id, legacy_organization_id, local_unit_kind')
        .eq('legacy_council_id', args.permissions.councilId)
        .limit(1)
        .maybeSingle<LocalUnitRow>()

      if (data?.id) {
        activeLocalUnitId = data.id
      }
    }

    if (!activeLocalUnitId && args.permissions.organizationId) {
      const { data } = await args.admin
        .from('local_units')
        .select('id, display_name, legacy_council_id, legacy_organization_id, local_unit_kind')
        .eq('legacy_organization_id', args.permissions.organizationId)
        .order('local_unit_kind', { ascending: true })
        .limit(1)
        .returns<LocalUnitRow[]>()

      activeLocalUnitId = data?.[0]?.id ?? null
    }

    if (!activeLocalUnitId) {
      return empty
    }

    const { data: localUnitData } = await args.admin
      .from('local_units')
      .select('id, display_name, legacy_council_id, legacy_organization_id, local_unit_kind')
      .eq('id', activeLocalUnitId)
      .maybeSingle<LocalUnitRow>()

    const currentLocalUnit = (localUnitData as LocalUnitRow | null) ?? null
    const { data: councilData } =
      currentLocalUnit?.legacy_council_id
        ? await args.admin
            .from('councils')
            .select('id, name, council_number, organization_id')
            .eq('id', currentLocalUnit.legacy_council_id)
            .maybeSingle<CouncilRow>()
        : { data: null }

    return {
      council: councilData ?? null,
      currentLocalUnit,
      switchableLocalUnits: [],
    }
  }

  const cookieStore = await cookies()
  const selectedLocalUnitId = getSelectedOperationsLocalUnitId({
    rawCookieValue: cookieStore.get(OPERATIONS_SCOPE_COOKIE)?.value ?? null,
  })

  const accessibleLocalUnits = await listHomeAccessibleLocalUnits({
    admin: args.admin,
    userId: args.permissions.authUser.id,
  })

  if (accessibleLocalUnits.length === 0) {
    return empty
  }

  let activeLocalUnitId =
    selectedLocalUnitId && accessibleLocalUnits.some((unit) => unit.local_unit_id === selectedLocalUnitId)
      ? selectedLocalUnitId
      : null

  if (!activeLocalUnitId && args.permissions.councilId) {
    const { data } = await args.admin
      .from('local_units')
      .select('id, display_name, legacy_council_id')
      .eq('legacy_council_id', args.permissions.councilId)
      .limit(1)
      .maybeSingle<LocalUnitRow>()

    if (data?.id && accessibleLocalUnits.some((unit) => unit.local_unit_id === data.id)) {
      activeLocalUnitId = data.id
    }
  }

  activeLocalUnitId ??= accessibleLocalUnits[0]?.local_unit_id ?? null

  if (!activeLocalUnitId) {
    return empty
  }

  const { data: localUnitData } = await args.admin
    .from('local_units')
    .select('id, display_name, legacy_council_id')
    .eq('id', activeLocalUnitId)
    .maybeSingle<LocalUnitRow>()

  const currentLocalUnit = (localUnitData as LocalUnitRow | null) ?? null
  const { data: councilData } =
    currentLocalUnit?.legacy_council_id
      ? await args.admin
          .from('councils')
          .select('id, name, council_number, organization_id')
          .eq('id', currentLocalUnit.legacy_council_id)
          .maybeSingle<CouncilRow>()
      : { data: null }

  return {
    council: councilData ?? null,
    currentLocalUnit,
    switchableLocalUnits: accessibleLocalUnits.filter((unit) => unit.local_unit_id !== activeLocalUnitId),
  }
}

export default async function HomePage() {
  const permissions = await getCurrentUserPermissions()

  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  if (permissions.isSuperAdmin && permissions.actingMode === 'member') {
    redirect('/spiritual')
  }

  if (!permissions.hasStaffAccess) {
    const needsProfileLanding = !permissions.personId
    redirect(needsProfileLanding ? '/me' : '/spiritual')
  }

  const admin = createAdminClient()
  const { council, currentLocalUnit, switchableLocalUnits } = await resolveHomeContext({
    admin,
    permissions,
  })

  if (!council?.id) {
    if (permissions.canManageEvents) redirect('/events')
    if (permissions.canAccessMemberData) redirect('/members')
    if (permissions.canManageCustomLists) redirect('/custom-lists')
    if (permissions.canAccessOrganizationSettings || permissions.canManageAdmins) redirect('/me/council')
    redirect('/spiritual')
  }

  const organization = await loadOrganizationProfile({
    admin,
    council,
  })

  const organizationName = getEffectiveOrganizationName(organization) ?? council.name ?? 'Organization'
  const effectiveBranding = getEffectiveOrganizationBranding(organization)
  const unitName = currentLocalUnit?.display_name?.trim() || council.name?.trim() || organizationName
  const publicMeetingsHref = council.council_number
    ? `/councils/${council.council_number}/meetings`
    : '/events'

  return (
    <main className="qv-page">
      <div className={`qv-shell ${styles.shell}`}>
        <AppHeader permissions={permissions} />

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p
              style={{
                margin: '0 0 12px',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
              }}
            >
              {council?.name ?? unitName}
              {council?.council_number ? ` (${council.council_number})` : ''}
            </p>

            <h1 className={styles.heroTitle}>
              Your ministry,
              <br />
              organized.
            </h1>

            {switchableLocalUnits.length > 0 && !(permissions.isSuperAdmin && permissions.actingMode !== 'normal') ? (
              <div style={{ marginTop: 18, width: 'fit-content', maxWidth: '100%', position: 'relative' }}>
                <details className="qv-view-menu" style={{ position: 'relative' }}>
                  <summary>
                    <span>Change local organization</span>
                    <span aria-hidden="true" className="qv-view-menu-chevron">
                      ▾
                    </span>
                  </summary>
                  <div className="qv-view-menu-panel" style={{ left: 0, right: 'auto' }}>
                    {switchableLocalUnits.map((unit) => (
                      <form key={unit.local_unit_id} method="post" action="/account/parallel-area-context">
                        <input type="hidden" name="areaCode" value={unit.areaCode} />
                        <input type="hidden" name="minimumAccessLevel" value={unit.minimumAccessLevel} />
                        <input type="hidden" name="localUnitId" value={unit.local_unit_id} />
                        <input type="hidden" name="next" value="/" />
                        <button
                          type="submit"
                          className="qv-view-menu-item"
                          style={{ width: '100%', justifyContent: 'flex-start' }}
                        >
                          {unit.local_unit_name}
                        </button>
                      </form>
                    ))}
                  </div>
                </details>
              </div>
            ) : null}
          </div>

          <div className={styles.heroLogo}>
            <OrganizationAvatar
              displayName={organizationName}
              logoStoragePath={effectiveBranding.logo_storage_path}
              logoAltText={effectiveBranding.logo_alt_text ?? `${organizationName} logo`}
              size={96}
              title={unitName}
            />
          </div>
        </section>

        <section className={styles.cardGrid} aria-label="Operations shortcuts">
          {permissions.canAccessMemberData || permissions.canManageCustomLists ? (
            <article className={styles.areaCard}>
              <div className={styles.cardInner}>
                <h2 className={styles.cardTitle}>Members</h2>
                <p className={styles.cardIntro}>
                  Your members are your strength. Keep their information close and make follow-up work easier.
                </p>

                {permissions.canAccessMemberData ? (
                  <div className={styles.cardSection}>
                    <p className={styles.cardSectionTitle}>Your members&apos; contact details always at hand.</p>
                    <Link href="/members" className={`qv-button-secondary qv-link-button ${styles.cardButton}`}>
                      Member Directory
                    </Link>
                  </div>
                ) : null}

                {permissions.canManageCustomLists ? (
                  <div className={styles.cardSection}>
                    <p className={styles.cardSectionTitle}>Targeted groups for outreach, follow-up, and planning.</p>
                    <Link href="/custom-lists" className={`qv-button-secondary qv-link-button ${styles.cardButton}`}>
                      Custom Lists
                    </Link>
                  </div>
                ) : null}
              </div>
              <div className={styles.cardBanner} aria-hidden="true" />
            </article>
          ) : null}

          {permissions.canManageEvents ? (
            <article className={styles.areaCard}>
              <div className={styles.cardInner}>
                <h2 className={styles.cardTitle}>Events</h2>
                <p className={styles.cardIntro}>
                  Ministry work takes organizing and planning. And it all starts with a good calendar.
                </p>

                <div className={styles.cardSection}>
                  <p className={styles.cardSectionTitle}>Keep members informed of upcoming meeting dates.</p>
                  <Link href={publicMeetingsHref} className={`qv-button-secondary qv-link-button ${styles.cardButton}`}>
                    Public Meeting Calendar
                  </Link>
                </div>

                <div className={styles.cardSection}>
                  <p className={styles.cardSectionTitle}>Schedule events, collect RSVPs, and line up volunteers.</p>
                  <Link href="/events" className={`qv-button-secondary qv-link-button ${styles.cardButton}`}>
                    Events Scheduler
                  </Link>
                </div>
              </div>
              <div className={styles.cardBanner} aria-hidden="true" />
            </article>
          ) : null}
        </section>
      </div>
    </main>
  )
}
