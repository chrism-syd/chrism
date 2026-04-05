import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import OrganizationAvatar from '@/app/components/organization-avatar'
import { findCurrentActingCouncilContextForArea } from '@/lib/auth/acting-context'
import { listAccessibleLocalUnitsForArea } from '@/lib/auth/area-access'
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

  const { data: councilData } = permissions.councilId
    ? await admin
        .from('councils')
        .select('id, name, council_number, organization_id')
        .eq('id', permissions.councilId)
        .maybeSingle<CouncilRow>()
    : { data: null }

  const council = councilData ?? null

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
  const unitName = council.name?.trim() || organizationName
  const publicMeetingsHref = council.council_number
    ? `/councils/${council.council_number}/meetings`
    : '/events'

  const operationsContext = await findCurrentActingCouncilContextForArea({
    areaCode: 'events',
    minimumAccessLevel: 'manage',
  })

  const switchableLocalUnits =
    operationsContext?.permissions.authUser
      ? (
          await listAccessibleLocalUnitsForArea({
            admin,
            userId: operationsContext.permissions.authUser.id,
            areaCode: 'events',
            minimumAccessLevel: 'manage',
          })
        )
          .filter((unit) => unit.local_unit_id !== operationsContext.localUnitId)
          .sort((left, right) => left.local_unit_name.localeCompare(right.local_unit_name))
      : []

  return (
    <main className="qv-page">
      <div className={`qv-shell ${styles.shell}`}>
        <AppHeader />

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <h1 className={styles.heroTitle}>
              Your ministry,
              <br />
              organized.
            </h1>

            {switchableLocalUnits.length > 0 ? (
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
                        <input type="hidden" name="areaCode" value="events" />
                        <input type="hidden" name="minimumAccessLevel" value="manage" />
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