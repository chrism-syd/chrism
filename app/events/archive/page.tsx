import Link from 'next/link'
import AppHeader from '@/app/app-header'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { formatEventDateTimeRange } from '@/lib/events/display'

type ActiveArchivedEventRow = {
  id: string
  title: string
  starts_at: string
  ends_at: string | null
  status_code: string
  location_name: string | null
  event_kind_code: 'standard' | 'general_meeting' | 'executive_meeting'
}

type DeletedEventArchiveRow = {
  id: string
  original_event_id: string | null
  title: string
  starts_at: string | null
  ends_at: string | null
  status_code: string | null
  location_name: string | null
  deleted_at: string
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function getArchiveStatusLabel(event: ActiveArchivedEventRow) {
  if (event.status_code === 'cancelled') return 'Cancelled'
  if (event.status_code === 'completed') return 'Completed'
  return 'Past'
}

function isMeeting(event: ActiveArchivedEventRow) {
  return event.event_kind_code === 'general_meeting' || event.event_kind_code === 'executive_meeting'
}

function renderHistoricalEventCard(event: ActiveArchivedEventRow) {
  return (
    <Link key={event.id} href={`/events/${event.id}`} className="qv-member-link">
      <article className="qv-member-row">
        <div style={{ display: 'grid', gap: 6 }}>
          <div className="qv-member-name">{event.title}</div>
          <div className="qv-inline-message">{formatEventDateTimeRange(event.starts_at, event.ends_at)}</div>
          <div className="qv-inline-message">{event.location_name || 'No location listed'}</div>
          <div className="qv-inline-message">Event • {getArchiveStatusLabel(event)}</div>
        </div>
        <div className="qv-member-row-right">
          <span className="qv-chevron">›</span>
        </div>
      </article>
    </Link>
  )
}

function renderHistoricalMeetingCard(event: ActiveArchivedEventRow) {
  const meetingLabel =
    event.event_kind_code === 'executive_meeting' ? 'Executive meeting' : 'General meeting'

  return (
    <Link key={event.id} href={`/events/${event.id}`} className="qv-member-link">
      <article className="qv-member-row">
        <div style={{ display: 'grid', gap: 6 }}>
          <div className="qv-member-name">{event.title}</div>
          <div className="qv-inline-message">{formatEventDateTimeRange(event.starts_at, event.ends_at)}</div>
          <div className="qv-inline-message">{event.location_name || 'No location listed'}</div>
          <div className="qv-inline-message">{meetingLabel} • Past</div>
        </div>
        <div className="qv-member-row-right">
          <span className="qv-chevron">›</span>
        </div>
      </article>
    </Link>
  )
}

export default async function EventArchivePage() {
  const { admin: supabase, council, localUnitId } = await getCurrentActingCouncilContext({
    redirectTo: '/events',
    areaCode: 'events',
    minimumAccessLevel: 'manage',
  })
  const nowIso = new Date().toISOString()

  const [{ data: historicalRows, error: historicalError }, { data: deletedEvents, error: deletedError }] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, starts_at, ends_at, status_code, location_name, event_kind_code')
      .eq(localUnitId ? 'local_unit_id' : 'council_id', localUnitId ?? council.id)
      .or(
        [
          'status_code.in.(completed,cancelled)',
          `and(event_kind_code.in.(general_meeting,executive_meeting),ends_at.lt.${nowIso})`,
          `and(event_kind_code.eq.standard,ends_at.lt.${nowIso},status_code.not.in.(draft,completed,cancelled))`,
          `and(event_kind_code.eq.standard,starts_at.lt.${nowIso},ends_at.is.null,status_code.not.in.(draft,completed,cancelled))`,
        ].join(',')
      )
      .order('starts_at', { ascending: false })
      .returns<ActiveArchivedEventRow[]>(),
    supabase
      .from('event_archives')
      .select('id, original_event_id, title, starts_at, ends_at, status_code, location_name, deleted_at')
      .eq(localUnitId ? 'local_unit_id' : 'council_id', localUnitId ?? council.id)
      .order('deleted_at', { ascending: false })
      .returns<DeletedEventArchiveRow[]>(),
  ])

  const allHistoricalRows = historicalRows ?? []
  const pastMeetings = allHistoricalRows.filter((event) => isMeeting(event))
  const pastEvents = allHistoricalRows.filter((event) => !isMeeting(event))

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-hero-top">
            <div>
              <p className="qv-eyebrow">
                {council.name ?? 'Council'}
                {council.council_number ? ` (${council.council_number})` : ''}
              </p>
              <h1 className="qv-title">Events archive</h1>
              <p className="qv-subtitle">Past events, past meetings, and manually archived event snapshots stay visible here for admins.</p>
            </div>
            <div className="qv-directory-actions">
              <Link href="/events" className="qv-link-button qv-button-secondary">
                Back to events
              </Link>
            </div>
          </div>
        </section>

        {historicalError || deletedError ? (
          <section className="qv-card qv-error">
            Could not load the event archive. {historicalError?.message || deletedError?.message}
          </section>
        ) : (
          <div className="qv-detail-grid">
            <section className="qv-card">
              <div className="qv-directory-section-head">
                <div>
                  <h2 className="qv-section-title">Past events</h2>
                  <p className="qv-section-subtitle">Standard events that ended already or were marked completed or cancelled.</p>
                </div>
              </div>

              {pastEvents.length === 0 ? (
                <div className="qv-empty">
                  <h3 className="qv-empty-title">No past events</h3>
                  <p className="qv-empty-text">Ended, completed, and cancelled standard events will appear here.</p>
                </div>
              ) : (
                <div className="qv-member-list">
                  {pastEvents.map((event) => renderHistoricalEventCard(event))}
                </div>
              )}
            </section>

            <section className="qv-card">
              <div className="qv-directory-section-head">
                <div>
                  <h2 className="qv-section-title">Past meetings</h2>
                  <p className="qv-section-subtitle">General and executive meetings that have already happened.</p>
                </div>
              </div>

              {pastMeetings.length === 0 ? (
                <div className="qv-empty">
                  <h3 className="qv-empty-title">No past meetings</h3>
                  <p className="qv-empty-text">Past general and executive meetings will appear here automatically.</p>
                </div>
              ) : (
                <div className="qv-member-list">
                  {pastMeetings.map((event) => renderHistoricalMeetingCard(event))}
                </div>
              )}
            </section>

            <section className="qv-card">
              <div className="qv-directory-section-head">
                <div>
                  <h2 className="qv-section-title">Manually archived</h2>
                  <p className="qv-section-subtitle">Snapshots captured when an organizer intentionally removed an event from the active list.</p>
                </div>
              </div>

              {(deletedEvents ?? []).length === 0 ? (
                <div className="qv-empty">
                  <h3 className="qv-empty-title">No manually archived events yet</h3>
                  <p className="qv-empty-text">Archived snapshots will appear here after someone archives an active event.</p>
                </div>
              ) : (
                <div className="qv-member-list">
                  {(deletedEvents ?? []).map((event) => (
                    <Link key={event.id} href={`/events/archive/${event.id}`} className="qv-member-link">
                      <article className="qv-member-row">
                        <div style={{ display: 'grid', gap: 6 }}>
                          <div className="qv-member-name">{event.title}</div>
                          <div className="qv-inline-message">{formatEventDateTimeRange(event.starts_at, event.ends_at)}</div>
                          <div className="qv-inline-message">{event.location_name || 'No location listed'}</div>
                          <div className="qv-inline-message">Archived {formatDateTime(event.deleted_at)}</div>
                        </div>
                        <div className="qv-member-row-right">
                          <span className="qv-chevron">›</span>
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
