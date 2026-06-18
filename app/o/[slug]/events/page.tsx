import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import OrganizationAvatar from '@/app/components/organization-avatar'
import MeetingKindFilter, { type PublicMeetingKindFilter } from './meeting-kind-filter'
import { DEFAULT_EVENT_TIME_ZONE } from '@/lib/events/time-zone'
import { bindSaintNames } from '@/lib/local-pages/text'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import { buildCouncilPublicOrgSlug, extractTrailingCouncilNumber } from '@/lib/public-org-slugs'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type EventsPageProps = {
  params: Promise<{ slug: string }>
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
  if (resolved === 'general' || resolved === 'executive' || resolved === 'community') return resolved
  return 'all'
}

function displayText(text: string | null | undefined) {
  return bindSaintNames(text ?? '')
}

function formatShortDay(isoString: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_EVENT_TIME_ZONE,
    weekday: 'short',
  }).format(new Date(isoString)).toUpperCase()
}

function formatDayNumber(isoString: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_EVENT_TIME_ZONE,
    day: 'numeric',
  }).format(new Date(isoString))
}

function formatDeadlineDate(isoString: string | null | undefined) {
  if (!isoString) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_EVENT_TIME_ZONE,
    month: 'short',
    day: 'numeric',
  }).format(new Date(isoString))
}

function formatTimeOnlyRange(startsAt: string, endsAt: string | null) {
  const start = new Date(startsAt)
  const end = endsAt ? new Date(endsAt) : null
  const timeFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_EVENT_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  })

  if (!end) return timeFormatter.format(start)
  return `${timeFormatter.format(start)} – ${timeFormatter.format(end)}`
}

function groupByMonth(events: MeetingRow[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  const byMonth = new Map<string, MeetingRow[]>()
  const monthKeyFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_EVENT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  })
  const monthLabelFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DEFAULT_EVENT_TIME_ZONE,
    month: 'short',
  })

  for (const event of events) {
    const eventDate = new Date(event.starts_at)
    const key = monthKeyFormatter.format(eventDate)
    const existing = byMonth.get(key) ?? []
    existing.push(event)
    byMonth.set(key, existing)
  }

  for (const [key, monthEvents] of byMonth.entries()) {
    const firstEvent = monthEvents[0]
    const monthLabel = firstEvent ? monthLabelFormatter.format(new Date(firstEvent.starts_at)) : key
    groups.push({ key, monthLabel, events: monthEvents })
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
    background: isCommunityEvent ? 'rgba(255,255,255,0.72)' : 'var(--bg-sunken)',
    border: '1px solid var(--divider-subtle)',
    textAlign: 'left' as const,
    boxSizing: 'border-box' as const,
  }
}

export default async function PublicOrgEventsPage({ params, searchParams }: EventsPageProps) {
  const { slug } = await params
  const { kind, meetingKind } = await searchParams
  const selectedKind = normalizeKindFilter(meetingKind ?? kind)
  const councilNumber = extractTrailingCouncilNumber(slug)

  if (!councilNumber) notFound()

  const supabase = createAdminClient()
  const authClient = await createClient()
  await authClient.auth.getUser()

  const { data: council } = await supabase
    .from('councils')
    .select('id, name, council_number, organization_id')
    .eq('council_number', councilNumber)
    .maybeSingle()

  if (!council?.id) notFound()

  const canonicalSlug = buildCouncilPublicOrgSlug({ name: council.name, councilNumber: council.council_number })
  if (slug !== canonicalSlug) {
    redirect(`/o/${canonicalSlug}/events`)
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
  const councilName = displayText(council.name || organizationName || 'Council')
  const feedHref = `/o/${canonicalSlug}/calendar.ics`
  const localOrgHref = `/o/${canonicalSlug}/events`
  const emptyUnitTerm = council.council_number ? 'council' : 'organization'
  const monthGroups = groupByMonth(meetings ?? [])
  const parentBrandName = council.council_number ? 'Knights of Columbus' : displayText(organizationName)

  return (
    <main style={{ background: '#fdfcf9', color: 'var(--text-primary)', minHeight: '100vh', paddingBottom: 56 }}>
      <style>{`
        .public-events-chrism-powered {
          opacity: 0.48;
          filter: grayscale(1) saturate(0);
          transition: opacity 160ms ease, filter 160ms ease;
        }

        .public-events-chrism-powered:hover,
        .public-events-chrism-powered:focus-visible {
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
        <Link href={localOrgHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 14, color: 'var(--text-primary)', textDecoration: 'none' }}>
          <OrganizationAvatar
            displayName={councilName}
            logoStoragePath={effectiveBranding.logo_storage_path}
            logoAltText={effectiveBranding.logo_alt_text ?? councilName}
            size={68}
          />
          <span style={{ display: 'grid', gap: 2 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 900, letterSpacing: '0.01em' }}>{parentBrandName}</span>
            <strong style={{ fontSize: 22, lineHeight: 1.08 }}>{councilName}</strong>
          </span>
        </Link>

        <Link href="/about" className="public-events-chrism-powered" style={{ display: 'inline-flex', alignItems: 'center' }} aria-label="About Chrism">
          <Image src="/Chrism_horiz.svg" alt="Chrism" width={92} height={31} priority />
        </Link>
      </header>

      <section
        id="events"
        style={{
          display: 'grid',
          gap: 22,
          padding: '56px clamp(20px, 6vw, 80px) 18px',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 'clamp(44px, 6vw, 78px)', lineHeight: 0.96, letterSpacing: '-0.045em' }}>
          Upcoming events
        </h1>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-start' }}>
          <Link href={feedHref} className="qv-link-button qv-button-secondary">Subscribe to this calendar</Link>
          <MeetingKindFilter value={selectedKind} />
        </div>
      </section>

      <section id="calendar" style={{ padding: '18px clamp(20px, 6vw, 80px) 0' }}>
        {(meetings ?? []).length === 0 ? (
          <div className="qv-empty" style={{ maxWidth: 760 }}>
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
                  gridTemplateColumns: '120px minmax(0, 1fr)',
                  gap: 28,
                  alignItems: 'start',
                  paddingBottom: groupIndex < monthGroups.length - 1 ? SHARED_VERTICAL_GAP : 0,
                  marginBottom: groupIndex < monthGroups.length - 1 ? SHARED_VERTICAL_GAP : 0,
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-heading), Georgia, serif',
                    fontSize: 'clamp(42px, 5vw, 72px)',
                    lineHeight: 0.92,
                    letterSpacing: '-0.04em',
                    color: 'var(--text-primary)',
                    paddingTop: 34,
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
                          borderRadius: 26,
                          background: isCommunityEvent ? 'var(--bg-sunken)' : 'transparent',
                          minWidth: 0,
                          boxSizing: 'border-box',
                        }}
                      >
                        <div style={getDateTileStyle(isCommunityEvent)}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
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
                                {displayText(meeting.title)}
                              </h2>
                              <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-primary)' }}>
                                {formatTimeOnlyRange(meeting.starts_at, meeting.ends_at)}
                              </div>
                              {meeting.location_name ? (
                                <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                                  {displayText(meeting.location_name)}
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
                                  {displayText(meeting.description)}
                                </div>
                              ) : null}
                            </div>

                            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'start', minWidth: 0 }}>
                              {meeting.requires_rsvp ? (
                                <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
                                  <Link
                                    href={`/events/${meeting.id}`}
                                    className="qv-link-button qv-button-primary"
                                    style={{ minWidth: 116, justifyContent: 'center', borderRadius: 16, padding: '14px 20px', fontSize: 16, fontWeight: 700, textDecoration: 'none' }}
                                  >
                                    RSVP
                                  </Link>
                                  {deadlineLabel ? <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>RSVP by {deadlineLabel}</div> : null}
                                </div>
                              ) : null}

                              {meeting.needs_volunteers ? (
                                <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
                                  <Link
                                    href={`/events/${meeting.id}`}
                                    className="qv-link-button qv-button-primary"
                                    style={{ minWidth: 132, justifyContent: 'center', borderRadius: 16, padding: '14px 20px', fontSize: 16, fontWeight: 700, textDecoration: 'none' }}
                                  >
                                    Volunteer
                                  </Link>
                                  {deadlineLabel ? <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Volunteer by {deadlineLabel}</div> : null}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gap: 4, minWidth: 0, paddingTop: 6 }}>
                            <h2 className="qv-section-title" style={{ margin: 0 }}>
                              {displayText(meeting.title)}
                            </h2>
                            <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-primary)' }}>
                              {formatTimeOnlyRange(meeting.starts_at, meeting.ends_at)}
                            </div>
                            {meeting.location_name ? (
                              <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                                {displayText(meeting.location_name)}
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
    </main>
  )
}
