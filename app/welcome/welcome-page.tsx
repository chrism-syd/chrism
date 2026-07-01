import Link from 'next/link'
import AppHeader from '@/app/app-header'
import OrganizationAvatar from '@/app/components/organization-avatar'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import styles from './welcome.module.css'

type WelcomePageVariant = 'admin' | 'member'

type WelcomePageProps = {
  variant: WelcomePageVariant
  smokeTestLocalUnitId?: string | null
}

type CouncilRow = {
  id: string
  name: string | null
  council_number: string | null
  organization_id: string | null
}

type LocalUnitRow = {
  id: string
  name?: string | null
  legacy_council_id: string | null
  legacy_organization_id: string | null
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

type WelcomeAction = {
  href: string
  label: string
  body: string
}

const memberActions: WelcomeAction[] = [
  {
    href: '/me',
    label: 'Review your profile',
    body: 'Keep your contact details current so your organization can stay connected with you.',
  },
  {
    href: '/events',
    label: 'View events',
    body: 'See meetings and events connected to your organization.',
  },
  {
    href: '/',
    label: 'Go to your home page',
    body: 'Start from your Chrism home base whenever you need to find your next step.',
  },
]

async function loadCouncilAndOrganization(args: {
  admin: ReturnType<typeof createAdminClient>
  localUnitId: string | null
  councilId: string | null
}) {
  let localUnit: LocalUnitRow | null = null

  if (args.localUnitId) {
    const { data } = await args.admin
      .from('local_units')
      .select('id, legacy_council_id, legacy_organization_id')
      .eq('id', args.localUnitId)
      .maybeSingle<LocalUnitRow>()

    localUnit = data ?? null
  }

  const councilId = localUnit?.legacy_council_id ?? args.councilId
  const organizationIdFromLocalUnit = localUnit?.legacy_organization_id ?? null
  let council: CouncilRow | null = null

  if (councilId) {
    const { data } = await args.admin
      .from('councils')
      .select('id, name, council_number, organization_id')
      .eq('id', councilId)
      .maybeSingle<CouncilRow>()

    council = data ?? null
  }

  const organizationId = organizationIdFromLocalUnit ?? council?.organization_id ?? null

  if (!organizationId) {
    return { localUnit, council, organization: null }
  }

  const { data: organization } = await args.admin
    .from('organizations')
    .select('display_name, preferred_name, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)')
    .eq('id', organizationId)
    .maybeSingle()

  return {
    localUnit,
    council,
    organization: (organization as OrganizationRow) ?? null,
  }
}

function getContent(variant: WelcomePageVariant) {
  if (variant === 'admin') {
    return {
      eyebrow: 'Admin access accepted',
      title: 'Welcome.',
      intro:
        'You have admin access so you can help care for your council’s members, events, and local operations. The best first step is the member directory.',
      noteTitle: 'Start with the people entrusted to you',
      noteBody:
        'Review the member directory first. Events and volunteer hours are here when you need them, but good member information is the foundation everything else rests on.',
      actions: [],
      primaryHref: '/people',
      primaryLabel: 'Start with members',
      secondaryHref: '/me/council',
      secondaryLabel: 'Organization settings',
    }
  }

  return {
    eyebrow: 'Account ready',
    title: 'Welcome to Chrism.',
    intro:
      'Thank you for signing up. Your account is ready, and you can now stay connected with your organization through Chrism.',
    noteTitle: 'You are in the right place',
    noteBody:
      'Chrism keeps profiles, events, and organization information close at hand so community work feels easier to follow.',
    actions: memberActions,
    primaryHref: '/me',
    primaryLabel: 'Review my profile',
    secondaryHref: null,
    secondaryLabel: null,
  }
}

function MemberOrganizationLookupPlaceholder() {
  return (
    <section className="qv-card">
      <div className="qv-directory-section-head">
        <div>
          <h2 className="qv-section-title">Find your organization</h2>
          <p className="qv-section-subtitle">
            Soon you will be able to search for your local organization, parish, council, conference, or ministry and request to join it on Chrism.
          </p>
        </div>
      </div>

      <div className="qv-form-grid">
        <label className="qv-control">
          <span className="qv-label">Organization lookup</span>
          <input type="search" placeholder="Search by name, parish, ministry, city, or council number" disabled />
        </label>

        <div className="qv-detail-list">
          <div className="qv-detail-item">
            <div className="qv-detail-label">When your organization is found</div>
            <div className="qv-detail-value">You will be able to request to join and send that request to the local admins for review.</div>
          </div>
          <div className="qv-detail-item">
            <div className="qv-detail-label">Admin review</div>
            <div className="qv-detail-value">An admin can connect your signed-in account to an existing member record or create one for you.</div>
          </div>
          <div className="qv-detail-item">
            <div className="qv-detail-label">Not listed yet</div>
            <div className="qv-detail-value">If your organization is not on Chrism yet, this flow can help start a setup request later.</div>
          </div>
        </div>

        <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
          <button type="button" className="qv-button-secondary" disabled>
            Coming soon
          </button>
        </div>
      </div>
    </section>
  )
}

export default async function WelcomePage({ variant, smokeTestLocalUnitId = null }: WelcomePageProps) {
  const permissions = await getCurrentUserPermissions()
  const admin = createAdminClient()
  const canUseSmokeTestScope = permissions.isSignedIn && Boolean(smokeTestLocalUnitId)
  const scopedLocalUnitId = canUseSmokeTestScope
    ? smokeTestLocalUnitId
    : permissions.activeLocalUnitId
  const { localUnit, council, organization } = await loadCouncilAndOrganization({
    admin,
    localUnitId: scopedLocalUnitId,
    councilId: canUseSmokeTestScope ? null : permissions.councilId,
  })
  const content = getContent(variant)
  const organizationName = getEffectiveOrganizationName(organization) ?? localUnit?.name ?? council?.name ?? 'Chrism'
  const effectiveBranding = getEffectiveOrganizationBranding(organization)
  const councilLabel = council?.name
    ? `${council.name}${council.council_number ? ` (${council.council_number})` : ''}`
    : localUnit?.name ?? organizationName

  return (
    <main className="qv-page">
      <div className={`qv-shell ${styles.shell}`}>
        <AppHeader permissions={permissions} />

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className="qv-eyebrow">{content.eyebrow}</p>
            <h1 className={styles.heroTitle}>{content.title}</h1>
            <p className={styles.heroIntro}>{content.intro}</p>
          </div>

          <div className={styles.heroLogo}>
            <OrganizationAvatar
              displayName={organizationName}
              logoStoragePath={effectiveBranding.logo_storage_path}
              logoAltText={effectiveBranding.logo_alt_text ?? `${organizationName} logo`}
              size={96}
              title={councilLabel}
            />
          </div>
        </section>

        <section className={styles.cardGrid} aria-label="Welcome next steps">
          <article className={styles.areaCard}>
            <div className={styles.cardInner}>
              <p className="qv-detail-label" style={{ margin: 0 }}>{councilLabel}</p>
              <h2 className={styles.cardTitle}>{content.noteTitle}</h2>
              <p className={styles.cardIntro}>{content.noteBody}</p>
              <div className={styles.cardActions}>
                <Link href={content.primaryHref} className={`qv-button-secondary qv-link-button ${styles.primaryAction}`}>
                  {content.primaryLabel}
                </Link>
                {content.secondaryHref && content.secondaryLabel ? (
                  <Link href={content.secondaryHref} className="qv-button-secondary qv-link-button">
                    {content.secondaryLabel}
                  </Link>
                ) : null}
              </div>
            </div>
            <div className={styles.cardBanner} aria-hidden="true" />
          </article>

          <aside className={styles.areaCard}>
            <div className={`${styles.cardInner} ${styles.sideCardInner}`}>
              <h2 className={styles.cardTitle}>What Chrism helps with</h2>
              <div className="qv-detail-list">
                <div className="qv-detail-item">
                  <div className="qv-detail-label">People</div>
                  <div className="qv-detail-value">Keep member and volunteer contact information close.</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Events</div>
                  <div className="qv-detail-value">Schedule meetings, plan events, and collect RSVPs and volunteer responses.</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Follow-up</div>
                  <div className="qv-detail-value">Make the next pastoral or practical step easier to see.</div>
                </div>
              </div>
            </div>
            <div className={styles.cardBanner} aria-hidden="true" />
          </aside>
        </section>

        {variant === 'member' ? <MemberOrganizationLookupPlaceholder /> : null}

        {variant === 'member' ? (
          <section className="qv-card">
            <div className="qv-directory-section-head">
              <div>
                <h2 className="qv-section-title">Choose your next step</h2>
                <p className="qv-section-subtitle">You can always come back to the home page later.</p>
              </div>
            </div>

            <div className={`qv-member-list ${styles.actionList}`}>
              {content.actions.map((action) => (
                <Link key={action.href} href={action.href} className={`qv-member-link ${styles.actionLink}`}>
                  <article className="qv-member-row">
                    <div className="qv-member-main">
                      <div className="qv-member-text">
                        <div className="qv-member-name">{action.label}</div>
                        <div className="qv-member-meta">{action.body}</div>
                      </div>
                    </div>
                    <div className="qv-member-row-right">
                      <span className="qv-chevron">›</span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
