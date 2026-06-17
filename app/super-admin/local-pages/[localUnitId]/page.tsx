import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import OrganizationAvatar from '@/app/components/organization-avatar'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { formatEventDateTimeRange } from '@/lib/events/display'
import { bindSaintNames, preventParagraphOrphans } from '@/lib/local-pages/text'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import { createAdminClient } from '@/lib/supabase/admin'
import LocalPageModalButton from './local-page-modal-button'

type PageProps = {
  params: Promise<{ localUnitId: string }>
}

type LocalUnitRow = {
  id: string
  legacy_organization_id: string | null
  legacy_council_id: string | null
  display_name: string | null
  official_name: string | null
  local_unit_kind: string | null
}

type OrganizationRow = {
  id: string
  display_name: string | null
  preferred_name: string | null
  organization_type_code: string | null
  logo_storage_path: string | null
  logo_alt_text: string | null
  brand_profile?: {
    code: string | null
    display_name: string | null
    logo_storage_bucket: string | null
    logo_storage_path: string | null
    logo_alt_text: string | null
  } | null
}

type CouncilRow = {
  id: string
  name: string | null
  council_number: string | null
}

type EventRow = {
  id: string
  title: string
  location_name: string | null
  location_address: string | null
  starts_at: string
  ends_at: string | null
  status_code: string
  event_kind_code: 'standard' | 'general_meeting' | 'executive_meeting'
  requires_rsvp: boolean
}

const HERO_VIDEO_SRC = '/o/assets/73228-548173103.mp4'
const CHRISM_YELLOW = '#f5c84b'

function localUnitLabel(unit: LocalUnitRow, council?: CouncilRow | null) {
  return unit.display_name?.trim() || unit.official_name?.trim() || council?.name?.trim() || 'Local organization'
}

function missionCopy() {
  return 'Empowering Catholic men to live out their faith through charity, unity, and fraternity.'
}

function heroSubtitle(displayName: string) {
  return `${displayName} is a registered not-for-profit local community organization, helping people stay connected through shared service and meaningful community work.`
}

function involvementCopy(code?: string | null) {
  if (code === 'knights_of_columbus') {
    return 'We share a desire to be better husbands, fathers, sons, neighbours, and role models, putting charity and community first. Attend an event, subscribe to meeting updates, or reach out to local leaders.'
  }

  return 'Attend an event, subscribe to meeting updates, or reach out to local leaders. Future versions of this page can support contact forms, join requests, sponsors, and custom sections.'
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function eventKindLabel(kind: EventRow['event_kind_code']) {
  if (kind === 'executive_meeting') return 'Executive meeting'
  if (kind === 'general_meeting') return 'General meeting'
  return 'Event'
}

function paragraph(text: string) {
  return preventParagraphOrphans(text)
}

function displayText(text: string | null | undefined) {
  return bindSaintNames(text ?? '')
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function LocalPageTemplatePreview({ params }: PageProps) {
  const permissions = await getCurrentUserPermissions()

  if (!permissions.authUser || !permissions.isSuperAdmin || permissions.actingMode !== 'normal') {
    redirect('/me')
  }

  const { localUnitId } = await params
  const admin = createAdminClient()

  const { data: localUnitData } = await admin
    .from('local_units')
    .select('id, legacy_organization_id, legacy_council_id, display_name, official_name, local_unit_kind')
    .eq('id', localUnitId)
    .maybeSingle<LocalUnitRow>()

  const localUnit = (localUnitData as LocalUnitRow | null) ?? null
  if (!localUnit) notFound()

  const [organizationResponse, councilResponse, eventsResponse] = await Promise.all([
    localUnit.legacy_organization_id
      ? admin
          .from('organizations')
          .select('id, display_name, preferred_name, organization_type_code, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)')
          .eq('id', localUnit.legacy_organization_id)
          .maybeSingle<OrganizationRow>()
      : Promise.resolve({ data: null }),
    localUnit.legacy_council_id
      ? admin
          .from('councils')
          .select('id, name, council_number')
          .eq('id', localUnit.legacy_council_id)
          .maybeSingle<CouncilRow>()
      : Promise.resolve({ data: null }),
    admin
      .from('events')
      .select('id, title, location_name, location_address, starts_at, ends_at, status_code, event_kind_code, requires_rsvp')
      .eq('local_unit_id', localUnit.id)
      .order('starts_at', { ascending: true })
      .returns<EventRow[]>(),
  ])

  const organization = (organizationResponse.data as OrganizationRow | null) ?? null
  const council = (councilResponse.data as CouncilRow | null) ?? null
  const organizationName = organization ? getEffectiveOrganizationName(organization) ?? null : null
  const organizationBranding = organization ? getEffectiveOrganizationBranding(organization) : null
  const displayName = displayText(localUnitLabel(localUnit, council))
  const councilNumber = council?.council_number ?? null
  const orgTypeCode = organization?.organization_type_code ?? null
  const nowIso = new Date().toISOString()
  const events = (eventsResponse.data ?? []).filter((event) =>
    !['draft', 'completed', 'cancelled'].includes(event.status_code) &&
    (event.ends_at ?? event.starts_at) >= nowIso
  )
  const publicEvents = events.filter((event) => event.event_kind_code === 'standard').slice(0, 6)
  const meetingEvents = events.filter((event) => event.event_kind_code !== 'standard').slice(0, 3)
  const publicMeetingsHref = councilNumber ? `/councils/${councilNumber}/meetings` : null
  const meetingsFeedHref = councilNumber ? `/councils/${councilNumber}/meetings.ics` : null
  const displayTitle = `${displayName}${councilNumber ? ` ${councilNumber}` : ''}`
  const parentBrandName = councilNumber ? 'Knights of Columbus' : displayText(organizationName) || 'Local organization'

  return (
    <main style={{ background: '#fdfcf9', color: 'var(--text-primary)', minHeight: '100vh' }}>
      <style>{`
        .local-page-chrism-powered {
          opacity: 0.48;
          filter: grayscale(1) saturate(0);
          transition: opacity 160ms ease, filter 160ms ease;
        }

        .local-page-chrism-powered:hover,
        .local-page-chrism-powered:focus-visible {
          opacity: 1;
          filter: none;
        }
      `}</style>

      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 18,
          padding: '14px clamp(20px, 6vw, 80px)',
          background: 'rgba(253, 252, 249, 0.94)',
          borderBottom: '1px solid var(--divider)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Link href="/super-admin/local-pages" style={{ display: 'inline-flex', alignItems: 'center', gap: 14, color: 'var(--text-primary)', textDecoration: 'none' }}>
          <OrganizationAvatar
            displayName={displayName}
            logoStoragePath={organizationBranding?.logo_storage_path ?? null}
            logoAltText={organizationBranding?.logo_alt_text ?? displayTitle}
            size={68}
          />
          <span style={{ display: 'grid', gap: 2 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 900, letterSpacing: '0.01em' }}>{parentBrandName}</span>
            <strong style={{ fontSize: 22, lineHeight: 1.08 }}>{displayName}</strong>
          </span>
        </Link>
        <nav style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', fontSize: 14, fontWeight: 700 }}>
          <a href="#about" style={{ color: 'var(--text-primary)' }}>About</a>
          <a href="#events" style={{ color: 'var(--text-primary)' }}>Events</a>
          <a href="#meetings" style={{ color: 'var(--text-primary)' }}>Meetings</a>
          <a href="#contact" style={{ color: 'var(--text-primary)' }}>Get involved</a>
        </nav>
        <Link href="/" className="local-page-chrism-powered" style={{ display: 'inline-flex', alignItems: 'center' }} aria-label="Powered by Chrism">
          <Image src="/Chrism_horiz.svg" alt="Chrism" width={92} height={31} priority />
        </Link>
      </header>

      <div style={{ padding: '18px clamp(20px, 6vw, 80px)', background: 'var(--bg-sunken)', borderBottom: '1px solid var(--divider)' }}>
        <strong>Super-admin preview only.</strong> This page is not publicly linked yet. Future URL treatment: <code>/o/[slug]</code>.
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.95fr) minmax(320px, 1.05fr)', gap: 28, padding: '64px clamp(20px, 6vw, 80px) 40px', alignItems: 'center' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(44px, 6vw, 78px)', lineHeight: 0.96, letterSpacing: '-0.045em' }}>
            Welcome to {displayTitle}
          </h1>
          <p style={{ margin: 0, maxWidth: 620, color: 'var(--text-secondary)', fontSize: 22, lineHeight: 1.35 }}>
            {paragraph(heroSubtitle(displayName))}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            <LocalPageModalButton label="Get Involved" title="Get involved" className="qv-link-button qv-button-primary">
              <div style={{ display: 'grid', gap: 14 }}>
                <p className="qv-section-subtitle" style={{ margin: 0 }}>
                  {paragraph('A contact form will live here in a future pass. For now, this preview confirms the modal interaction and placement.')}
                </p>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  {paragraph(`Visitors will eventually be able to contact ${displayName}, request more information, or express interest in getting involved.`)}
                </p>
              </div>
            </LocalPageModalButton>
          </div>
        </div>

        <div style={{ position: 'relative', minHeight: 'clamp(420px, 44vw, 620px)' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: '70%', aspectRatio: '1 / 1', overflow: 'hidden', background: 'var(--bg-sunken)' }}>
            <video
              src={HERO_VIDEO_SRC}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              aria-label="Community service video"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
          <div id="about" style={{ position: 'absolute', right: 0, top: '28%', width: '68%', padding: '42px clamp(28px, 5vw, 58px)', background: CHRISM_YELLOW, color: 'var(--text-primary)', borderRadius: 0, boxShadow: '0 18px 50px rgba(46, 42, 52, 0.16)' }}>
            <p style={{ margin: '0 0 10px', opacity: 0.78, fontWeight: 800 }}>Our mission</p>
            <p style={{ margin: 0, fontSize: 'clamp(26px, 3vw, 40px)', lineHeight: 1.22 }}>
              {paragraph(missionCopy())}
            </p>
          </div>
        </div>
      </section>

      <section id="events" style={{ padding: '48px clamp(20px, 6vw, 80px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid var(--divider)', paddingBottom: 14 }}>
          <div>
            <h2 className="qv-section-title" style={{ margin: 0, color: 'var(--qv-plum)' }}>Events</h2>
            <p className="qv-section-subtitle" style={{ margin: '6px 0 0' }}>
              {paragraph('Upcoming events')}
            </p>
          </div>
          {publicMeetingsHref ? (
            <LocalPageModalButton label="See More" title="Upcoming events" iframeSrc={publicMeetingsHref} />
          ) : null}
        </div>

        {publicEvents.length > 0 ? (
          <div style={{ display: 'grid' }}>
            {publicEvents.map((event) => (
              <div key={event.id} style={{ display: 'grid', gridTemplateColumns: '130px minmax(0, 1fr)', gap: 18, alignItems: 'center', padding: '24px 0', borderBottom: '1px solid var(--divider)' }}>
                <div style={{ color: 'var(--text-secondary)', fontWeight: 800 }}>{formatShortDate(event.starts_at)}</div>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontSize: 26, fontWeight: 800 }}>{displayText(event.title)}</div>
                  <span style={{ color: 'var(--text-secondary)' }}>/ {displayText(event.location_name || event.location_address || 'Location to be confirmed')}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="qv-empty" style={{ marginTop: 22 }}>
            <h3 className="qv-empty-title">No public events yet</h3>
            <p className="qv-empty-text">{paragraph('Public events will appear here once this local organization publishes them in Chrism.')}</p>
          </div>
        )}
      </section>

      <section id="meetings" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(280px, 1.1fr)', gap: 28, padding: '48px clamp(20px, 6vw, 80px)', alignItems: 'stretch' }}>
        <div style={{ borderRadius: 28, minHeight: 260, background: 'var(--bg-sunken)', border: '1px solid var(--divider)' }} />
        <div style={{ padding: '42px clamp(28px, 5vw, 56px)', background: 'var(--qv-plum)', color: 'white', borderRadius: 8 }}>
          <p style={{ margin: '0 0 10px', opacity: 0.8, fontWeight: 700 }}>Meetings</p>
          <h2 style={{ margin: 0, fontSize: 'clamp(30px, 4vw, 52px)', lineHeight: 1.08 }}>Stay connected to regular council life.</h2>
          <p style={{ fontSize: 18, lineHeight: 1.5, opacity: 0.88 }}>
            {paragraph('Public meeting information and calendar subscription links help members keep upcoming gatherings on their own calendars.')}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 22 }}>
            {publicMeetingsHref ? <Link href={publicMeetingsHref} className="qv-link-button qv-button-secondary">Public Meetings Page</Link> : null}
            {meetingsFeedHref ? <Link href={meetingsFeedHref} className="qv-link-button qv-button-secondary">ICS Feed</Link> : null}
          </div>
          {meetingEvents.length > 0 ? (
            <div style={{ display: 'grid', gap: 12, marginTop: 28 }}>
              {meetingEvents.map((event) => (
                <div key={event.id} style={{ paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.25)' }}>
                  <strong>{displayText(event.title)}</strong>
                  <div style={{ opacity: 0.82 }}>{eventKindLabel(event.event_kind_code)} • {formatEventDateTimeRange(event.starts_at, event.ends_at)}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section id="contact" style={{ padding: '48px clamp(20px, 6vw, 80px) 70px' }}>
        <div className="qv-card" style={{ display: 'grid', gap: 18, background: 'var(--bg-sunken)' }}>
          <p className="qv-eyebrow">Get involved</p>
          <h2 className="qv-section-title" style={{ margin: 0 }}>Interested in what is happening at {displayName}?</h2>
          <p className="qv-section-subtitle" style={{ maxWidth: 760 }}>
            {paragraph(involvementCopy(orgTypeCode))}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <LocalPageModalButton label="Get Involved" title="Get involved" className="qv-link-button qv-button-primary">
              <div style={{ display: 'grid', gap: 14 }}>
                <p className="qv-section-subtitle" style={{ margin: 0 }}>
                  {paragraph('A contact form will live here in a future pass. For now, this preview confirms the modal interaction and placement.')}
                </p>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  {paragraph(`Visitors will eventually be able to contact ${displayName}, request more information, or express interest in getting involved.`)}
                </p>
              </div>
            </LocalPageModalButton>
            {publicMeetingsHref ? <Link href={publicMeetingsHref} className="qv-link-button qv-button-secondary">View Meetings</Link> : null}
          </div>
        </div>
      </section>

      <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', padding: '34px clamp(20px, 6vw, 80px)', background: 'var(--qv-plum)', color: 'white' }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <strong>{displayTitle}</strong>
          <span style={{ opacity: 0.8 }}>{paragraph('Powered by Chrism. This is a generated local organization page preview.')}</span>
        </div>
        <Link href="/super-admin/local-pages" className="qv-link-button qv-button-secondary">Back to previews</Link>
      </footer>
    </main>
  )
}
