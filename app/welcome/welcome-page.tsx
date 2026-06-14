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
}

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

type WelcomeAction = {
  href: string
  label: string
  body: string
}

const adminActions: WelcomeAction[] = [
  {
    href: '/members',
    label: 'Review member directory',
    body: 'Make sure the people entrusted to your council are easy to find and follow up with.',
  },
  {
    href: '/events',
    label: 'Plan events',
    body: 'Create events, collect RSVPs, and organize volunteers from one calm place.',
  },
  {
    href: '/me/council',
    label: 'Open council settings',
    body: 'Review organization details, admin access, and operational settings.',
  },
]

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
  councilId: string | null
}) {
  if (!args.councilId) {
    return { council: null, organization: null }
  }

  const { data: council } = await args.admin
    .from('councils')
    .select('id, name, council_number, organization_id')
    .eq('id', args.councilId)
    .maybeSingle<CouncilRow>()

  if (!council?.organization_id) {
    return { council: council ?? null, organization: null }
  }

  const { data: organization } = await args.admin
    .from('organizations')
    .select('display_name, preferred_name, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)')
    .eq('id', council.organization_id)
    .maybeSingle()

  return {
    council: council ?? null,
    organization: (organization as OrganizationRow) ?? null,
  }
}

function getContent(variant: WelcomePageVariant) {
  if (variant === 'admin') {
    return {
      eyebrow: 'Admin access accepted',
      title: 'Welcome, shepherd.',
      intro:
        'You have been given admin access so you can help care for your council’s members, events, and local operations.',
      noteTitle: 'A practical first step',
      noteBody:
        'Start by reviewing the member directory and upcoming events. Chrism is here to make the ordinary work lighter, not to add another pile to your desk.',
      actions: adminActions,
      primaryHref: '/members',
      primaryLabel: 'Start with members',
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
  }
}

export default async function WelcomePage({ variant }: WelcomePageProps) {
  const permissions = await getCurrentUserPermissions()
  const admin = createAdminClient()
  const { council, organization } = await loadCouncilAndOrganization({
    admin,
    councilId: permissions.councilId,
  })
  const content = getContent(variant)
  const organizationName = getEffectiveOrganizationName(organization) ?? council?.name ?? 'Chrism'
  const effectiveBranding = getEffectiveOrganizationBranding(organization)
  const councilLabel = council?.name
    ? `${council.name}${council.council_number ? ` (${council.council_number})` : ''}`
    : organizationName

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
              <Link href={content.primaryHref} className={`qv-button-secondary qv-link-button ${styles.primaryAction}`}>
                {content.primaryLabel}
              </Link>
            </div>
            <div className={styles.cardBanner} aria-hidden="true" />
          </article>

          <aside className={styles.areaCard}>
            <div className={`${styles.cardInner} ${styles.sideCardInner}`}>
              <h2 className={styles.cardTitle}>What Chrism helps with</h2>
              <div className="qv-detail-list">
                <div className="qv-detail-item">
                  <div className="qv-detail-label">People</div>
                  <div className="qv-detail-value">Keep member and contact information close.</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Events</div>
                  <div className="qv-detail-value">Plan meetings, events, RSVPs, and volunteer responses.</div>
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
      </div>
    </main>
  )
}
