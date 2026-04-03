import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import OrganizationAvatar from '@/app/components/organization-avatar'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEffectiveOrganizationName } from '@/lib/organizations/names'
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
} | null

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

  const { data: organizationData } = council.organization_id
    ? await admin
        .from('organizations')
        .select('display_name, preferred_name, logo_storage_path, logo_alt_text')
        .eq('id', council.organization_id)
        .maybeSingle<Exclude<OrganizationRow, null>>()
    : { data: null }

  const organization = (organizationData ?? null) as OrganizationRow
  const organizationName = getEffectiveOrganizationName(organization) ?? council.name ?? 'Organization'
  const unitName = council.name?.trim() || organizationName
  const publicMeetingsHref = council.council_number
    ? `/councils/${council.council_number}/meetings`
    : '/events'

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
          </div>

          <div className={styles.heroLogo}>
            <OrganizationAvatar
              displayName={organizationName}
              logoStoragePath={organization?.logo_storage_path ?? null}
              fallbackLogoPath="/organizations/knights-of-columbus-logo.png"
              logoAltText={organization?.logo_alt_text ?? `${organizationName} logo`}
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
