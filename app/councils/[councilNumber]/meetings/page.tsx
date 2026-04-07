import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import OrganizationAvatar from '@/app/components/organization-avatar'
import MeetingKindFilter, { type PublicMeetingKindFilter } from './meeting-kind-filter'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import aboutStyles from '@/app/about/about.module.css'

type MeetingsPageProps = {
  params: Promise<{ councilNumber: string }>
  searchParams: Promise<{ kind?: string | string[]; meetingKind?: string | string[] }>
}

type MeetingRow = {
  id: string
  title: string
  description: string | null
  location_name: string | null
  location_address: string | null
  starts_at: string
  ends_at: string | null
  event_kind_code: 'standard' | 'general_meeting' | 'executive_meeting'
  updated_at: string
  requires_rsvp: boolean
  needs_volunteers: boolean
  rsvp_deadline_at?: string | null
  status_code: 'draft' | 'scheduled' | 'completed' | 'cancelled'
}

type MonthGroup = {
  key: string
  monthLabel: string
  events: MeetingRow[]
}

const DATE_TILE_WIDTH = 102
const SHARED_ROW_INSET = 28
const SHARED_VERTICAL_GAP = 18

export const dynamic = 'force-dynamic'
export const revalidate = 0

function normalizeKindFilter(value: string | string[] | undefined): PublicMeetingKindFilter {
  const resolved = Array.isArray(value) ? value[0] : value
  if (resolved === 'general' || resolved === 'executive' || resolved === 'community') {
    return resolved
  }
  return 'all'
}

function formatShortDay(isoString: string) {
  return new Intl.DateTimeFormat('en-CA', { weekday: 'short' }).format(new Date(isoString)).toUpperCase()
}

function formatDayNumber(isoString: string) {
  return new Intl.DateTimeFormat('en-CA', { day: 'numeric' }).format(new Date(isoString))
}

function formatDeadlineDate(isoString: string | null | undefined) {
  if (!isoString) return null
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(new Date(isoString))
}

function formatTimeOnlyRange(startsAt: string, endsAt: string | null) {
  const start = new Date(startsAt)
  const end = endsAt ? new Date(endsAt) : null

  const timeFormatter = new Intl.DateTimeFormat('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
  })

  if (!end) {
    return timeFormatter.format(start)
  }

  return `${timeFormatter.format(start)} – ${timeFormatter.format(end)}`
}

function groupByMonth(events: MeetingRow[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  const byMonth = new Map<string, MeetingRow[]>()

  for (const event of events) {
    const eventDate = new Date(event.starts_at)
    const key = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit' }).format(eventDate)
    const existing = byMonth.get(key) ?? []
    existing.push(event)
    byMonth.set(key, existing)
  }

  for (const [key, monthEvents] of byMonth.entries()) {
    const firstEvent = monthEvents[0]
    const monthLabel = firstEvent
      ? new Intl.DateTimeFormat('en-CA', { month: 'short' }).format(new Date(firstEvent.starts_at))
      : key

    groups.push({
      key,
      monthLabel,
      events: monthEvents,
    })
  }

  return groups
}

function getDateTileStyle(isCommunityEvent: boolean) {
  return {
    display: 'grid',
    alignContent: 'start',
    justifyItems: 'start',
    gap: 4,
    width: DATE_TILE_WIDTH,
    minHeight: 92,
    padding: '14px 4px 12px 14px',
    borderRadius: 18,
    background: isCommunityEvent ? 'rgba(255,255,255,0.62)' : 'var(--bg-sunken)',
    border: '1px solid var(--divider-subtle)',
    textAlign: 'left' as const,
    boxSizing: 'border-box' as const,
  }
}

export default async function PublicCouncilMeetingsPage({ params, searchParams }: MeetingsPageProps) {
  const { councilNumber } = await params
  const { kind, meetingKind } = await searchParams
  const selectedKind = normalizeKindFilter(meetingKind ?? kind)
  const supabase = createAdminClient()
  const authClient = await createClient()
  await authClient.auth.getUser()

  const signInHref = '/login'

  const { data: council } = await supabase
    .from('councils')
    .select('id, name, council_number, organization_id')
    .eq('council_number', councilNumber)
    .maybeSingle()

  if (!council?.id) {
    notFound()
  }

  const meetingsQuery = supabase
    .from('events')
    .select('id, title, description, location_name, location_address, starts_at, ends_at, event_kind_code, updated_at, requires_rsvp, needs_volunteers, rsvp_deadline_at, status_code')
    .eq('council_id', council.id)
    .eq('status_code', 'scheduled')
    .in('event_kind_code', ['standard', 'general_meeting', 'executive_meeting'])
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true })

  if (selectedKind === 'general') {
    meetingsQuery.eq('event_kind_code', 'general_meeting')
  } else if (selectedKind === 'executive') {
    meetingsQuery.eq('event_kind_code', 'executive_meeting')
  } else if (selectedKind === 'community') {
    meetingsQuery.eq('event_kind_code', 'standard')
  }

  const [{ data: meetings }, { data: organizationData }] = await Promise.all([
    meetingsQuery.returns<MeetingRow[]>(),
    council.organization_id
      ? supabase
          .from('organizations')
          .select('display_name, preferred_name, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)')
          .eq('id', council.organization_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const organization = organizationData as {
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

  const organizationName = getEffectiveOrganizationName(organization) ?? council.name ?? 'Council'
  const effectiveBranding = getEffectiveOrganizationBranding(organization)
  const councilName = council.name || organizationName || 'Council'
  const feedHref = `/councils/${council.council_number}/meetings.ics`
  const emptyUnitTerm = council.council_number ? 'council' : 'organization'
  const monthGroups = groupByMonth(meetings ?? [])

  return (
    <main className="qv-page" style={{ paddingBottom: 56 }}>
      <div className="qv-shell">
        <header className={aboutStyles.topBar}>
          <Link href="/" className={aboutStyles.brandLink} aria-label="Chrism home">
            <Image
              src="/Chrism_horiz.svg"
              alt="Chrism"
              width={419}
              height={98}
              priority
              className={aboutStyles.brandImage}
            />
          </Link>

          <Link href={signInHref} className={`qv-button-secondary qv-link-button ${aboutStyles.signInButton}`}>
            Sign in
          </Link>
        </header>

        <section className="qv-hero-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              {council.council_number ? <p className="qv-eyebrow">Council {council.council_number}</p> : null}
              <div className="qv-directory-title-row">
                <h1 className="qv-directory-name">{councilName}</h1>
              </div>
              <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
                Upcoming events
              </p>
            </div>

            <div className="qv-org-avatar-wrap">
              <OrganizationAvatar
                displayName={organizationName}
                logoStoragePath={effectiveBranding.logo_storage_path}
                logoAltText={effectiveBranding.logo_alt_text ?? organizationName}
                size={72}
              />
            </div>
          </div>
        </section>

        <div className="qv-section-menu-shell qv-public-meetings-menu-shell">
          <div className="qv-public-meetings-menu-row">
            <p className="qv-public-meetings-menu-copy">Add this to your personal calendar</p>
            <Link href={feedHref} className="qv-link-button qv-section-menu-link qv-public-meetings-menu-link">
              Subscribe via ICS
            </Link>
          </div>
        </div>

        <section className="qv-card" style={{ overflow: 'hidden', paddingBottom: 36, marginBottom: 40 }}>
          <div className="qv-directory-section-head qv-public-meetings-head">
            <MeetingKindFilter value={selectedKind} />
          </div>

          {(meetings ?? []).length === 0 ? (
            <div className="qv-empty">
              <p className="qv-empty-title">No events have been added to your {emptyUnitTerm} calendar.</p>
              <p className="qv-empty-text">Check back later for the next published meeting or community event.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 0, paddingBottom: 12 }}>
              {monthGroups.map((group, groupIndex) => (
                <section
                  key={group.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '88px minmax(0, 1fr)',
                    gap: 18,
                    alignItems: 'start',
                    paddingBottom: groupIndex < monthGroups.length - 1 ? SHARED_VERTICAL_GAP : 0,
                    marginBottom: groupIndex < monthGroups.length - 1 ? SHARED_VERTICAL_GAP : 0,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-heading), Georgia, serif',
                      fontSize: 'clamp(34px, 4vw, 54px)',
                      lineHeight: 0.92,
                      letterSpacing: '-0.04em',
                      color: 'var(--text-primary)',
                      paddingTop: 10,
                    }}
                  >
                    {group.monthLabel}
                  </div>

                  <div style={{ display: 'grid', gap: SHARED_VERTICAL_GAP, minWidth: 0 }}>
                    {group.events.map((meeting) => {
                      const isCommunityEvent = meeting.event_kind_code === 'standard'
                      const deadlineLabel = formatDeadlineDate(meeting.rsvp_deadline_at)

                      return (
                        <article
                          key={meeting.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: `${DATE_TILE_WIDTH}px minmax(0, 1fr)`,
                            gap: 20,
                            alignItems: 'start',
                            padding: `22px 20px 22px ${SHARED_ROW_INSET}px`,
                            borderRadius: 18,
                            background: isCommunityEvent ? 'var(--bg-sunken)' : 'transparent',
                            minWidth: 0,
                            boxSizing: 'border-box',
                          }}
                        >
                          <div style={getDateTileStyle(isCommunityEvent)}>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 400,
                                color: 'var(--text-secondary)',
                                letterSpacing: '-0.01em',
                                lineHeight: 1,
                              }}
                            >
                              {formatShortDay(meeting.starts_at)}
                            </div>
                            <div className="qv-stat-number" style={{ lineHeight: 0.86 }}>
                              {formatDayNumber(meeting.starts_at)}
                            </div>
                          </div>

                          {isCommunityEvent ? (
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(220px, 1.15fr) minmax(180px, 0.9fr) minmax(220px, 0.85fr)',
                                gap: 20,
                                alignItems: 'start',
                                minWidth: 0,
                                paddingTop: 6,
                              }}
                            >
                              <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                                <h2 className="qv-section-title" style={{ margin: 0 }}>
                                  {meeting.title}
                                </h2>
                                <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-primary)' }}>
                                  {formatTimeOnlyRange(meeting.starts_at, meeting.ends_at)}
                                </div>
                                {meeting.location_name ? (
                                  <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                                    {meeting.location_name}
                                  </div>
                                ) : null}
                              </div>

                              <div
                                style={{
                                  minHeight: 74,
                                  paddingLeft: 20,
                                  borderLeft: '1px solid var(--divider-strong)',
                                  display: 'grid',
                                  alignContent: 'start',
                                  minWidth: 0,
                                }}
                              >
                                {meeting.description ? (
                                  <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-primary)' }}>
                                    {meeting.description}
                                  </div>
                                ) : null}
                              </div>

                              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'start', minWidth: 0 }}>
                                {meeting.requires_rsvp ? (
                                  <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
                                    <Link
                                      href={`/events/${meeting.id}`}
                                      className="qv-link-button qv-button-primary"
                                      style={{
                                        minWidth: 116,
                                        justifyContent: 'center',
                                        borderRadius: 16,
                                        padding: '14px 20px',
                                        fontSize: 16,
                                        fontWeight: 700,
                                        textDecoration: 'none',
                                      }}
                                    >
                                      RSVP
                                    </Link>
                                    {deadlineLabel ? (
                                      <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                                        RSVP by {deadlineLabel}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}

                                {meeting.needs_volunteers ? (
                                  <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
                                    <Link
                                      href={`/events/${meeting.id}`}
                                      className="qv-link-button qv-button-primary"
                                      style={{
                                        minWidth: 132,
                                        justifyContent: 'center',
                                        borderRadius: 16,
                                        padding: '14px 20px',
                                        fontSize: 16,
                                        fontWeight: 700,
                                        textDecoration: 'none',
                                      }}
                                    >
                                      Volunteer
                                    </Link>
                                    {deadlineLabel ? (
                                      <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                                        Volunteer by {deadlineLabel}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gap: 4, minWidth: 0, paddingTop: 6 }}>
                              <h2 className="qv-section-title" style={{ margin: 0 }}>
                                {meeting.title}
                              </h2>
                              <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-primary)' }}>
                                {formatTimeOnlyRange(meeting.starts_at, meeting.ends_at)}
                              </div>
                              {meeting.location_name ? (
                                <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                                  {meeting.location_name}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </article>
                      )
                    })}

                    {groupIndex < monthGroups.length - 1 ? (
                      <div
                        aria-hidden="true"
                        style={{
                          height: 2,
                          background: 'rgba(38, 29, 53, 0.14)',
                          marginLeft: 0,
                          width: '100%',
                          borderRadius: 999,
                        }}
                      />
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
