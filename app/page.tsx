import Image from 'next/image'
import Link from 'next/link'
import { cookies, headers } from 'next/headers'
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
import { getCurrentUserPermissions, type CurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import styles from './about/about.module.css'
import faqStyles from './faq-image.module.css'
import flywheelStyles from './flywheel-star.module.css'
import InvoiceReviewCta from './invoice-review-cta'
import stewardshipStyles from './stewardship-section.module.css'
import heroStyles from './landing-hero.module.css'
import homeStyles from './home.module.css'

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

function noOrphan(text: string) {
  return text.replace(/\s+(\S+)$/, '\u00a0$1')
}

function getRequestHost(value: string | null) {
  return (value ?? '').split(':')[0]?.trim().toLowerCase() ?? ''
}

function isMarketingHost(host: string) {
  return host === 'chrismworks.com' || host === 'www.chrismworks.com' || host === 'chrismworks.ca' || host === 'www.chrismworks.ca'
}

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
  permissions: CurrentUserPermissions
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

const flywheelSteps = [
  {
    title: 'Reach',
    copy: 'Access to trade-level vendors, pricing, and production relationships your organization couldn\'t easily get on its own.',
  },
  {
    title: 'Redirect',
    copy: 'Most of that margin stays in the ecosystem — not in a corporate bottom line somewhere else. We run lean so more of it can.',
  },
  {
    title: 'Reinvest',
    copy: 'That value keeps core tools free or deeply subsidized for the organizations that need them most.',
  },
  {
    title: 'Repeat',
    copy:
      'Every order, every subscription, every sourcing request compounds. The more Chrism is used, the more it can do — for everyone in it.',
  },
]

const faqs = [
  {
    question: 'How is Chrism free for organizations?',
    answer:
      'Chrism uses commercial print sourcing, fundraising products, and procurement margin to subsidize the software platform. The goal is to let commercial activity support community infrastructure instead of asking every small organization to carry another software bill.',
  },
  {
    question: 'What does Chrism offer?',
    answer:
      'Chrism offers software for member management, events, volunteer coordination, communication, and local organization context. It also supports print sourcing, fundraising products, designed materials, and institutional procurement work.',
  },
  {
    question: 'What kind of print work can Chrism source?',
    answer:
      'Chrism can help source Christmas cards, certificates, postcards, signs, banners, apparel, forms, bulletins, fundraising materials, and other institutional print needs.',
  },
  {
    question: 'How does Chrism help fundraising?',
    answer:
      'Chrism designs and sources premium goods at wholesale or trade-aware pricing so local groups can sell them at healthy margins. The model is especially useful for products like Christmas cards, where strong design and production quality can become a real fundraising advantage.',
  },
  {
    question: 'Does Chrism replace existing systems?',
    answer:
      'No. Chrism is best understood as a practical coordination layer for organizations, members, leaders, volunteers, events, and local operations. It is meant to reduce everyday friction, not replace every system an organization already uses.',
  },
  {
    question: 'How does Chrism protect user information?',
    answer:
      'Chrism uses passwordless authentication, secure HTTPS, responsible access controls, and organization-based permissions. User information is shared only with organizations a user belongs to or chooses to connect with.',
  },
]

async function OperationsHomePage({ permissions }: { permissions: CurrentUserPermissions }) {
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
    redirect('/me')
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
      <div className={`qv-shell ${homeStyles.shell}`}>
        <AppHeader permissions={permissions} />

        <section className={homeStyles.hero}>
          <div className={homeStyles.heroCopy}>
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

            <h1 className={homeStyles.heroTitle}>
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

          <div className={homeStyles.heroLogo}>
            <OrganizationAvatar
              displayName={organizationName}
              logoStoragePath={effectiveBranding.logo_storage_path}
              logoAltText={effectiveBranding.logo_alt_text ?? `${organizationName} logo`}
              size={96}
              title={unitName}
            />
          </div>
        </section>

        <section className={homeStyles.cardGrid} aria-label="Operations shortcuts">
          {permissions.canAccessMemberData || permissions.canManageCustomLists ? (
            <article className={homeStyles.areaCard}>
              <div className={homeStyles.cardInner}>
                <h2 className={homeStyles.cardTitle}>Members</h2>
                <p className={`${homeStyles.cardIntro} ${homeStyles.membersCardIntro}`}>
                  Your members are your strength. Keep their information close and make follow-up work easier.
                </p>

                {permissions.canAccessMemberData ? (
                  <div className={homeStyles.cardSection}>
                    <p className={homeStyles.cardSectionTitle}>Your members&apos; contact details always at hand.</p>
                    <Link href="/members" className={`qv-button-secondary qv-link-button ${homeStyles.cardButton}`}>
                      Member Directory
                    </Link>
                  </div>
                ) : null}

                {permissions.canManageCustomLists ? (
                  <div className={homeStyles.cardSection}>
                    <p className={homeStyles.cardSectionTitle}>Targeted groups for outreach, follow-up, and planning.</p>
                    <Link href="/custom-lists" className={`qv-button-secondary qv-link-button ${homeStyles.cardButton}`}>
                      Custom Lists
                    </Link>
                  </div>
                ) : null}
              </div>
              <div className={homeStyles.cardBanner} aria-hidden="true" />
            </article>
          ) : null}

          {permissions.canManageEvents ? (
            <article className={homeStyles.areaCard}>
              <div className={homeStyles.cardInner}>
                <h2 className={homeStyles.cardTitle}>Events</h2>
                <p className={homeStyles.cardIntro}>
                  Ministry work takes organizing and planning. And it all starts with a good calendar.
                </p>

                <div className={homeStyles.cardSection}>
                  <p className={homeStyles.cardSectionTitle}>Keep members informed of upcoming meeting dates.</p>
                  <Link href={publicMeetingsHref} className={`qv-button-secondary qv-link-button ${homeStyles.cardButton}`}>
                    Public Meeting Calendar
                  </Link>
                </div>

                <div className={homeStyles.cardSection}>
                  <p className={homeStyles.cardSectionTitle}>Schedule events, collect RSVPs, and line up volunteers.</p>
                  <Link href="/events" className={`qv-button-secondary qv-link-button ${homeStyles.cardButton}`}>
                    Events Scheduler
                  </Link>
                </div>
              </div>
              <div className={homeStyles.cardBanner} aria-hidden="true" />
            </article>
          ) : null}
        </section>
      </div>
    </main>
  )
}

function MarketingLandingPage() {
  return (
    <main className="qv-page">
      <div className={`qv-shell ${styles.aboutShell}`}>
        <header className={styles.topBar}>
          <Link href="/" className={styles.brandLink} aria-label="Chrism home">
            <Image
              src="/Chrism_horiz.svg"
              alt="Chrism"
              width={419}
              height={98}
              priority
              className={styles.brandImage}
            />
          </Link>

          <Link href="https://www.chrism.app" className={`qv-button-secondary qv-link-button ${styles.signInButton}`}>
            Launch Operations
          </Link>
        </header>

        <section className={`${styles.heroBlock} ${heroStyles.heroBlock}`}>
          <div className={heroStyles.heroCopy}>
            <h1 className={`${styles.heroTitle} ${heroStyles.animatedHeroTitle}`}>
              <span className={heroStyles.heroSentencePrimary}>
                Built for
                <br />
                community.
              </span>
              <span className={heroStyles.heroSentenceSecondary}>
                <span className={heroStyles.heroAccent}>Optimized</span>
                <br />
                for business.
              </span>
            </h1>
          </div>

          <div className={`${styles.heroBadge} ${heroStyles.heroBadge}`}>
            <Image
              src="/Chrism_horiz.svg"
              alt="Chrism"
              width={419}
              height={98}
              className={styles.heroBadgeLogo}
              priority
            />
          </div>
        </section>

        <section className={`${styles.splitSection} ${styles.whatIsChrismSection}`}>
          <div className={styles.imageCard}>
            <Image
              src="/landing/chrism-main-screenshot.jpg"
              alt="Chrism member management interface"
              width={1200}
              height={800}
              className={styles.featureImage}
            />
          </div>

          <div className={styles.copyBlock}>
            <p className={styles.eyebrow}>What is Chrism?</p>
            <h2 className={`${styles.sectionTitle} ${styles.whatIsChrismTitle}`}>The parish-friendly operations layer.</h2>
            <p className={styles.bodyText}>
              Chrism helps Catholic organizations manage members, plan events, coordinate volunteers, and keep admin work from becoming a second apostolate.
            </p>
          </div>
        </section>

        <section className={`${styles.splitSection} ${styles.whoSection}`}>
          <div className={styles.copyBlock}>
            <p className={styles.eyebrow}>Who it is for</p>
            <h2 className={styles.sectionTitle}>Built for councils, conferences, ministries, and parish teams.</h2>
            <p className={styles.bodyText}>
              From Knights of Columbus councils to parish ministries and charitable groups, Chrism keeps people, roles, meetings, and outreach in one calm place.
            </p>
          </div>

          <div className={`${styles.imageCard} ${styles.imageCardPadless} ${faqStyles.imagePanel}`}
            aria-hidden="true"
          >
            <div className={faqStyles.imageStack}>
              <span className={`${faqStyles.imageTile} ${faqStyles.tileCalendar}`}>Public meeting calendar</span>
              <span className={`${faqStyles.imageTile} ${faqStyles.tileMembers}`}>Member directory</span>
              <span className={`${faqStyles.imageTile} ${faqStyles.tileRsvp}`}>RSVP flow</span>
              <span className={`${faqStyles.imageTile} ${faqStyles.tileVolunteer}`}>Volunteer tracking</span>
            </div>
          </div>
        </section>

        <section className={`${styles.splitSection} ${styles.productsSection}`}>
          <div className={styles.copyBlock}>
            <p className={styles.eyebrow}>Why products are here</p>
            <h2 className={styles.sectionTitle}>Tools funded by the work communities already buy.</h2>
            <p className={styles.bodyText}>
              Chrism also helps source print, fundraising goods, and institutional products. That commercial margin helps keep the operations platform sustainable for the groups that need it most.
            </p>
          </div>

          <div className={styles.productCardGrid}>
            <div className={styles.productCard}>Christmas cards</div>
            <div className={styles.productCard}>Certificates</div>
            <div className={styles.productCard}>Fundraising products</div>
            <div className={styles.productCard}>Signs &amp; banners</div>
          </div>
        </section>

        <section className={`${styles.flywheelSection} ${flywheelStyles.flywheelSection}`}>
          <div>
            <p className={styles.eyebrow}>The flywheel</p>
            <h2 className={`${styles.sectionTitle} ${flywheelStyles.flywheelTitle}`}>Commerce that keeps community tools accessible.</h2>
          </div>

          <div className={flywheelStyles.flywheelGrid}>
            {flywheelSteps.map((step, index) => (
              <div key={step.title} className={flywheelStyles.flywheelStep}>
                <span className={flywheelStyles.stepNumber}>{String(index + 1).padStart(2, '0')}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <InvoiceReviewCta />

        <section className={`${styles.splitSection} ${stewardshipStyles.section}`}>
          <div className={styles.copyBlock}>
            <p className={styles.eyebrow}>Stewardship</p>
            <h2 className={styles.sectionTitle}>{noOrphan('A practical way to make local work lighter.')}</h2>
            <p className={styles.bodyText}>
              Start with member, event, and volunteer coordination. Use Chrism where it removes friction, and leave the rest of your systems intact.
            </p>
          </div>

          <div className={stewardshipStyles.card}>
            <h3>Built to be useful before it is big.</h3>
            <p>
              The platform focuses on everyday work first: people, meetings, events, RSVPs, and follow-up. Commercial services help it stay available without turning every feature into another invoice.
            </p>
          </div>
        </section>

        <section className={styles.faqSection}>
          <div>
            <p className={styles.eyebrow}>FAQ</p>
            <h2 className={styles.sectionTitle}>A few practical answers.</h2>
          </div>

          <div className={styles.faqList}>
            {faqs.map((faq) => (
              <details key={faq.question} className={styles.faqItem}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

export default async function HomePage() {
  const headerStore = await headers()
  const host = getRequestHost(headerStore.get('x-forwarded-host') ?? headerStore.get('host'))

  if (isMarketingHost(host)) {
    return <MarketingLandingPage />
  }

  const permissions = await getCurrentUserPermissions()

  if (!permissions.authUser) {
    return <MarketingLandingPage />
  }

  return <OperationsHomePage permissions={permissions} />
}
