import Link from 'next/link'
import AppHeader from '@/app/app-header'
import OrganizationAvatar from '@/app/components/organization-avatar'
import SectionMenuBar from '@/app/components/section-menu-bar'
import { findCurrentActingCouncilContextForArea, type ActingCouncilContext } from '@/lib/auth/acting-context'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { listAccessibleLocalUnitsForArea } from '@/lib/auth/area-access'
import {
  getCouncilInboxEventHref,
  getMemberInvitedEventHref,
  getPublicMeetingsHref,
  listCouncilInboxEvents,
  listMemberInvitedEvents,
  type CouncilInboxEvent,
  type MemberInvitedEvent,
} from '@/lib/member-navigation'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatEventDateTimeRange } from '@/lib/events/display'

type EventRow = {
  id: string
  title: string
  location_name: string | null
  starts_at: string
  ends_at: string | null
  status_code: string
  scope_code: 'home_council_only' | 'multi_council'
  requires_rsvp: boolean
  needs_volunteers: boolean
  event_kind_code: 'standard' | 'general_meeting' | 'executive_meeting'
}

type EventSummaryRow = {
  event_id: string
  invited_council_count: number
  responded_council_count: number
  total_volunteer_count: number
}

type EventPersonSummaryRow = {
  event_id: string
  active_submission_count: number
  total_volunteer_count: number
  last_responded_at: string | null
}

type OrganizationProfileRow = {
  display_name: string | null
  preferred_name: string | null
  logo_storage_path: string | null
  logo_alt_text: string | null
  org_type_code?: string | null
  brand_profile?: {
    code: string | null
    display_name: string | null
    logo_storage_bucket: string | null
    logo_storage_path: string | null
    logo_alt_text: string | null
  } | null
}

type CouncilContextRow = {
  id: string
  name: string | null
  council_number: string | null
  organization_id: string | null
}

function getEventScopeLabels(orgTypeCode: string | null | undefined) {
  switch (orgTypeCode) {
    case 'parish':
      return {
        home: 'Parish event',
        multi: 'Community event',
      }
    case 'ssvp':
      return {
        home: 'Home conference only',
        multi: 'Multi-conference event',
      }
    case 'cwl':
      return {
        home: 'Home council only',
        multi: 'Multi-council event',
      }
    case 'knights_of_columbus':
    default:
      return {
        home: 'Home council only',
        multi: 'Multi-council event',
      }
  }
}

function getScopeLabel(scopeCode: EventRow['scope_code'], orgTypeCode: string | null | undefined) {
  const labels = getEventScopeLabels(orgTypeCode)
  return scopeCode === 'multi_council' ? labels.multi : labels.home
}

function getMeetingLabel(kind: EventRow['event_kind_code']) {
  if (kind === 'executive_meeting') return 'Executive meeting'
  if (kind === 'general_meeting') return 'General meeting'
  return 'Meeting'
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="qv-empty">
      <h3 className="qv-empty-title">{title}</h3>
      <p className="qv-empty-text">{body}</p>
    </div>
  )
}

async function loadOrganizationProfile(args: {
  admin: ReturnType<typeof createAdminClient>
  council: CouncilContextRow
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

  return (data as OrganizationProfileRow | null) ?? null
}

function renderInvitedEventList(events: MemberInvitedEvent[]) {
  if (!events.length) return null

  return (
    <div className="qv-member-list">
      {events.map((event) => {
        const eventHref = getMemberInvitedEventHref(event)

        return eventHref ? (
          <Link key={event.event_id} href={eventHref} className="qv-member-link">
            <article className="qv-member-row">
              <div className="qv-member-main">
                <div className="qv-member-text">
                  <div className="qv-member-name">{event.event_title}</div>
                  <div className="qv-member-meta">{formatEventDateTimeRange(event.starts_at, event.ends_at)}</div>
                  {event.location_name ? <div className="qv-member-meta">{event.location_name}</div> : null}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                    <span className="qv-mini-pill">{event.source_label}</span>
                    <span className="qv-mini-pill">Public event page</span>
                  </div>
                </div>
              </div>

              <div className="qv-member-row-right">
                <span className="qv-chevron">›</span>
              </div>
            </article>
          </Link>
        ) : (
          <article key={event.event_id} className="qv-member-row">
            <div className="qv-member-main">
              <div className="qv-member-text">
                <div className="qv-member-name">{event.event_title}</div>
                <div className="qv-member-meta">{formatEventDateTimeRange(event.starts_at, event.ends_at)}</div>
                {event.location_name ? <div className="qv-member-meta">{event.location_name}</div> : null}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  <span className="qv-mini-pill">{event.source_label}</span>
                </div>

                <div className="qv-member-meta" style={{ marginTop: 10 }}>
                  This invite is missing its public link.
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}


function renderCouncilInboxEventList(events: CouncilInboxEvent[]) {
  if (!events.length) return null

  return (
    <div className="qv-member-list">
      {events.map((event) => {
        const eventHref = getCouncilInboxEventHref(event)

        return eventHref ? (
          <Link key={event.event_id} href={eventHref} className="qv-member-link">
            <article className="qv-member-row">
              <div className="qv-member-main">
                <div className="qv-member-text">
                  <div className="qv-member-name">{event.event_title}</div>
                  <div className="qv-member-meta">{formatEventDateTimeRange(event.starts_at, event.ends_at)}</div>
                  {event.location_name ? <div className="qv-member-meta">{event.location_name}</div> : null}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                    <span className="qv-mini-pill">Council invite</span>
                    <span className="qv-mini-pill">Public event page</span>
                  </div>

                  {event.invite_contact_name || event.invite_email ? (
                    <div className="qv-member-meta" style={{ marginTop: 10 }}>
                      {event.invite_contact_name ? `Contact: ${event.invite_contact_name}` : null}
                      {event.invite_contact_name && event.invite_email ? ' · ' : null}
                      {event.invite_email ? event.invite_email : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="qv-member-row-right">
                <span className="qv-chevron">›</span>
              </div>
            </article>
          </Link>
        ) : (
          <article key={event.event_id} className="qv-member-row">
            <div className="qv-member-main">
              <div className="qv-member-text">
                <div className="qv-member-name">{event.event_title}</div>
                <div className="qv-member-meta">{formatEventDateTimeRange(event.starts_at, event.ends_at)}</div>
                {event.location_name ? <div className="qv-member-meta">{event.location_name}</div> : null}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  <span className="qv-mini-pill">Council invite</span>
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

async function MemberEventsPage() {
  const permissions = await getCurrentUserPermissions()
  const admin = createAdminClient()

  const [memberInvitedEvents, publicMeetingsHref, councilData] = await Promise.all([
    listMemberInvitedEvents({ admin, permissions, limit: 50 }),
    getPublicMeetingsHref({ admin, councilId: permissions.councilId }),
    permissions.councilId
      ? admin
          .from('councils')
          .select('id, name, council_number, organization_id')
          .eq('id', permissions.councilId)
          .maybeSingle<CouncilContextRow>()
      : Promise.resolve({ data: null }),
  ])

  const council = (councilData.data as CouncilContextRow | null) ?? null
  const organization = council ? await loadOrganizationProfile({ admin, council }) : null
  const organizationName = getEffectiveOrganizationName(organization) ?? council?.name ?? 'Chrism'
  const effectiveBranding = getEffectiveOrganizationBranding(organization)

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader permissions={permissions} />

        <section className="qv-hero-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              <p className="qv-eyebrow">
                {organizationName}
                {council?.council_number ? ` (${council.council_number})` : ''}
              </p>
              <div className="qv-directory-title-row">
                <h1 className="qv-directory-name">Events</h1>
              </div>
              <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
                View the public page for events you are invited to. RSVP names stay private.
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

        {publicMeetingsHref ? <SectionMenuBar items={[{ label: 'Public meetings', href: publicMeetingsHref }]} /> : null}

        <div className="qv-detail-grid">
          <div className="qv-detail-stack">
            <section className="qv-card">
              <div className="qv-directory-section-head">
                <div>
                  <h2 className="qv-section-title">Your invited events</h2>
                  <p className="qv-section-subtitle">Open the public event page to view details or continue to your RSVP.</p>
                </div>
              </div>

              {memberInvitedEvents.length > 0 ? (
                renderInvitedEventList(memberInvitedEvents)
              ) : (
                <EmptyState
                  title="No invited events yet"
                  body="When an event invitation matches your email or member record, it will appear here."
                />
              )}
            </section>
          </div>

          <div className="qv-detail-stack">
            <section className="qv-card">
              <div className="qv-directory-section-head">
                <div>
                  <h2 className="qv-section-title">Privacy</h2>
                  <p className="qv-section-subtitle">Members can see event details and their own RSVP path, not respondent rosters.</p>
                </div>
              </div>

              <div className="qv-detail-list">
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Public event page</div>
                  <div className="qv-detail-value">Visible to invited members.</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Your RSVP</div>
                  <div className="qv-detail-value">Accessible through your invite flow.</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Other respondents</div>
                  <div className="qv-detail-value">Hidden from members.</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}

async function AdminEventsPage({ context }: { context: ActingCouncilContext }) {
  const { admin: supabase, council, permissions, localUnitId } = context
  const [organization, councilInboxEvents, memberInvitedEvents] = await Promise.all([
    loadOrganizationProfile({ admin: supabase, council }),
    listCouncilInboxEvents({ admin: supabase, permissions, limit: 12 }),
    listMemberInvitedEvents({ admin: supabase, permissions, limit: 12 }),
  ])

  const organizationName = getEffectiveOrganizationName(organization) ?? council.name ?? 'Organization'
  const effectiveBranding = getEffectiveOrganizationBranding(organization)
  const currentCouncilLabel = `${council.name ?? organizationName}${council.council_number ? ` (${council.council_number})` : ''}`
  const publicMeetingsHref = council.council_number ? `/councils/${council.council_number}/meetings` : null
  const meetingsFeedHref = council.council_number ? `/councils/${council.council_number}/meetings.ics` : null

  const switchableLocalUnits = permissions.authUser
    ? (
        await listAccessibleLocalUnitsForArea({
          admin: supabase,
          userId: permissions.authUser.id,
          areaCode: 'events',
          minimumAccessLevel: 'manage',
        })
      )
        .filter((unit) => unit.local_unit_id !== localUnitId)
        .sort((left, right) => left.local_unit_name.localeCompare(right.local_unit_name))
    : []

  const { data: eventsData, error: eventsError } = await supabase
    .from('events')
    .select('id, title, location_name, starts_at, ends_at, status_code, scope_code, requires_rsvp, needs_volunteers, event_kind_code')
    .eq('council_id', council.id)
    .order('starts_at', { ascending: true })
    .returns<EventRow[]>()

  if (eventsError) {
    return (
      <main className="qv-page">
        <div className="qv-shell">
          <AppHeader permissions={permissions} />
          <section className="qv-card qv-error">Could not load events.</section>
        </div>
      </main>
    )
  }

  const events = eventsData ?? []
  const standardEvents = events.filter((event) => event.event_kind_code === 'standard')
  const nowIso = new Date().toISOString()
  const meetingEvents = events.filter(
    (event) =>
      event.event_kind_code !== 'standard' &&
      !['draft', 'completed', 'cancelled'].includes(event.status_code) &&
      (event.ends_at ?? event.starts_at) >= nowIso,
  )
  const draftEvents = standardEvents.filter((event) => event.status_code === 'draft')
  const scheduledEvents = standardEvents.filter((event) => !['draft', 'completed', 'cancelled'].includes(event.status_code))

  const standardIds = standardEvents.map((event) => event.id)
  const multiIds = standardEvents.filter((event) => event.scope_code === 'multi_council').map((event) => event.id)
  const singleIds = standardEvents.filter((event) => event.scope_code === 'home_council_only').map((event) => event.id)

  let councilSummaries: EventSummaryRow[] = []
  let personSummaries: EventPersonSummaryRow[] = []
  let externalInviteeCountMap = new Map<string, number>()

  if (multiIds.length) {
    const { data } = await supabase
      .from('event_host_summary')
      .select('event_id, invited_council_count, responded_council_count, total_volunteer_count')
      .in('event_id', multiIds)
      .returns<EventSummaryRow[]>()
    councilSummaries = data ?? []
  }

  if (singleIds.length) {
    const { data } = await supabase
      .from('event_person_rsvp_summary')
      .select('event_id, active_submission_count, total_volunteer_count, last_responded_at')
      .in('event_id', singleIds)
      .returns<EventPersonSummaryRow[]>()
    personSummaries = data ?? []
  }

  if (standardIds.length) {
    const { data } = await supabase.from('event_external_invitees').select('event_id').in('event_id', standardIds)
    const counts = new Map<string, number>()
    for (const row of data ?? []) {
      const eventId = (row as { event_id: string }).event_id
      counts.set(eventId, (counts.get(eventId) ?? 0) + 1)
    }
    externalInviteeCountMap = counts
  }

  const councilSummaryMap = new Map(councilSummaries.map((summary) => [summary.event_id, summary]))
  const personSummaryMap = new Map(personSummaries.map((summary) => [summary.event_id, summary]))

  function renderStandardEventList(eventRows: EventRow[]) {
    if (!eventRows.length) return null

    return (
      <div className="qv-member-list">
        {eventRows.map((event) => {
          const isSingle = event.scope_code === 'home_council_only'
          const councilSummary = councilSummaryMap.get(event.id)
          const personSummary = personSummaryMap.get(event.id)
          const respondedCount = isSingle ? personSummary?.active_submission_count ?? 0 : councilSummary?.responded_council_count ?? 0
          const volunteerCount = isSingle ? personSummary?.total_volunteer_count ?? 0 : councilSummary?.total_volunteer_count ?? 0
          const invitedCount = isSingle ? null : councilSummary?.invited_council_count ?? 0
          const externalInviteeCount = externalInviteeCountMap.get(event.id) ?? 0

          return (
            <Link key={event.id} href={`/events/${event.id}`} className="qv-member-link">
              <article className="qv-member-row">
                <div className="qv-member-main">
                  <div className="qv-member-text">
                    <div className="qv-member-name">{event.title}</div>
                    <div className="qv-member-meta">{formatEventDateTimeRange(event.starts_at, event.ends_at)}</div>
                    {event.location_name ? <div className="qv-member-meta">{event.location_name}</div> : null}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                      <span className="qv-mini-pill">{getScopeLabel(event.scope_code, organization?.org_type_code)}</span>
                      {event.requires_rsvp ? <span className="qv-mini-pill">RSVP On</span> : null}
                      {event.needs_volunteers ? <span className="qv-mini-pill">Volunteers On</span> : null}
                    </div>

                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
                      {!isSingle ? <span className="qv-member-meta">Invited: {invitedCount ?? 0}</span> : null}
                      <span className="qv-member-meta">RSVPs: {respondedCount}</span>
                      <span className="qv-member-meta">Volunteers: {volunteerCount}</span>
                      <span className="qv-member-meta">External invitees: {externalInviteeCount}</span>
                    </div>
                  </div>
                </div>

                <div className="qv-member-row-right">
                  <span className="qv-chevron">›</span>
                </div>
              </article>
            </Link>
          )
        })}
      </div>
    )
  }

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader permissions={permissions} />

        <section
          style={{
            display: 'grid',
            gap: 14,
            paddingTop: 28,
            marginBottom: 18,
          }}
        >
          <h1
            className="qv-directory-name"
            style={{
              margin: 0,
              fontSize: 'clamp(42px, 6.4vw, 68px)',
              lineHeight: 0.96,
              letterSpacing: '-0.04em',
              whiteSpace: 'nowrap',
            }}
          >
            Events
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: '34ch',
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.35,
              color: 'var(--text-secondary)',
            }}
          >
            Manage events, meetings, RSVPs, and volunteer responses.
          </p>
        </section>

        <section className="qv-hero-card">
          <div style={{ display: 'grid', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 18,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'grid', gap: 12 }}>
                <h2 className="qv-section-title" style={{ margin: 0 }}>
                  {currentCouncilLabel}
                </h2>

                {switchableLocalUnits.length > 0 && !permissions.isDevMode ? (
                  <details className="qv-view-menu">
                    <summary>
                      <span>Change local organization</span>
                      <span aria-hidden="true" className="qv-view-menu-chevron">
                        ▾
                      </span>
                    </summary>
                    <div className="qv-view-menu-panel">
                      {switchableLocalUnits.map((unit) => (
                        <form key={unit.local_unit_id} method="post" action="/account/parallel-area-context">
                          <input type="hidden" name="areaCode" value="events" />
                          <input type="hidden" name="minimumAccessLevel" value="manage" />
                          <input type="hidden" name="localUnitId" value={unit.local_unit_id} />
                          <input type="hidden" name="next" value="/events" />
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
                ) : null}
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
          </div>
        </section>

        <SectionMenuBar items={[{ label: 'Add event', href: '/events/new' }, { label: 'Archived events', href: '/events/archive' }]} />

        <div className="qv-detail-grid">
          <div className="qv-detail-stack">
            <section className="qv-card">
              <div className="qv-directory-section-head">
                <div>
                  <h2 className="qv-section-title">Invited to your council</h2>
                  <p className="qv-section-subtitle">
                    Multi-council events that were sent to this council.
                  </p>
                </div>
              </div>

              {councilInboxEvents.length > 0 ? (
                renderCouncilInboxEventList(councilInboxEvents)
              ) : (
                <EmptyState
                  title="No council invites yet"
                  body="When another council invites this council to a multi-council event, it will appear here."
                />
              )}
            </section>

            <section className="qv-card">
              <div className="qv-directory-section-head">
                <div>
                  <h2 className="qv-section-title">Your invited events</h2>
                  <p className="qv-section-subtitle">
                    Personal RSVP or guest-invite matches tied to your own identity.
                  </p>
                </div>
              </div>

              {memberInvitedEvents.length > 0 ? (
                renderInvitedEventList(memberInvitedEvents)
              ) : (
                <EmptyState
                  title="No personal event matches yet"
                  body="When an event RSVP or guest invite matches your email or member record, it will appear here."
                />
              )}
            </section>

            {scheduledEvents.length > 0 ? (
              <section className="qv-card">
                <div className="qv-directory-section-head">
                  <div>
                    <h2 className="qv-section-title">Scheduled events</h2>
                    <p className="qv-section-subtitle">{scheduledEvents.length} active</p>
                  </div>
                </div>
                {renderStandardEventList(scheduledEvents)}
              </section>
            ) : null}

            {draftEvents.length > 0 ? (
              <section className="qv-card">
                <div className="qv-directory-section-head">
                  <div>
                    <h2 className="qv-section-title">Drafts</h2>
                    <p className="qv-section-subtitle">{draftEvents.length} saved</p>
                  </div>
                </div>
                {renderStandardEventList(draftEvents)}
              </section>
            ) : null}

            {scheduledEvents.length === 0 && draftEvents.length === 0 ? (
              <section className="qv-card">
                <EmptyState
                  title="No events yet"
                  body="Create your first event to start tracking participation and RSVP responses."
                />
              </section>
            ) : null}
          </div>

          <div className="qv-detail-stack">
            {meetingEvents.length > 0 ? (
              <section className="qv-card">
                <div className="qv-directory-section-head" style={{ alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <h2 className="qv-section-title">Meetings</h2>
                    <p className="qv-section-subtitle">Upcoming council meetings only. Completed meetings move to the archive.</p>
                  </div>

                  {publicMeetingsHref || meetingsFeedHref ? (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {publicMeetingsHref ? (
                        <Link href={publicMeetingsHref} className="qv-link-button qv-button-secondary">
                          Public meetings page
                        </Link>
                      ) : null}
                      {meetingsFeedHref ? (
                        <Link href={meetingsFeedHref} className="qv-link-button qv-button-secondary">
                          ICS feed
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="qv-detail-list">
                  {meetingEvents.map((event) => (
                    <div key={event.id} className="qv-detail-item">
                      <div className="qv-detail-label">{formatEventDateTimeRange(event.starts_at, event.ends_at)}</div>
                      <div className="qv-detail-value">
                        <Link href={`/events/${event.id}`} className="qv-inline-link">
                          {event.title}
                        </Link>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                        <span className="qv-mini-pill">{getMeetingLabel(event.event_kind_code)}</span>
                      </div>
                      {event.location_name ? (
                        <div style={{ marginTop: 4, fontSize: 14, color: 'var(--text-secondary)' }}>{event.location_name}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  )
}

export default async function EventsPage() {
  const manageContext = await findCurrentActingCouncilContextForArea({
    areaCode: 'events',
    minimumAccessLevel: 'manage',
  })

  if (manageContext) {
    return <AdminEventsPage context={manageContext} />
  }

  return <MemberEventsPage />
}