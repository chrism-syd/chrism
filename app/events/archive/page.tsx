import Link from 'next/link'
import AppHeader from '@/app/app-header'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'

type ActiveArchivedEventRow = {
  id: string
  title: string
  starts_at: string
  ends_at: string
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

function formatDateRange(startsAt: string | null, endsAt: string | null) {
  if (!startsAt || !endsAt) return 'Date not available'
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const timeFormatter = new Intl.DateTimeFormat('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
  })
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()

  if (sameDay) {
    return `${dateFormatter.format(start)} • ${timeFormatter.format(start)} to ${timeFormatter.format(end)}`
  }

  return `${dateFormatter.format(start)} ${timeFormatter.format(start)} to ${dateFormatter.format(end)} ${timeFormatter.format(end)}`
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
  if (event.event_kind_code !== 'standard') return 'Completed'
  return 'Completed'
}

function getArchiveMetaLabel(event: ActiveArchivedEventRow) {
  if (event.event_kind_code === 'executive_meeting') return 'Executive meeting'
  if (event.event_kind_code === 'general_meeting') return 'General meeting'
  return 'Event'
}

export default async function EventArchivePage() {
  const { admin: supabase, council } = await getCurrentActingCouncilContext({ redirectTo: '/events' })
  const nowIso = new Date().toISOString()

  const [{ data: completedEvents, error: completedError }, { data: deletedEvents, error: deletedError }] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, starts_at, ends_at, status_code, location_name, event_kind_code')
      .eq('council_id', council.id)
      .or(`status_code.in.(completed,cancelled),and(event_kind_code.in.(general_meeting,executive_meeting),ends_at.lt.${nowIso})`)
      .order('starts_at', { ascending: false })
      .returns<ActiveArchivedEventRow[]>(),
    supabase
      .from('event_archives')
      .select('id, original_event_id, title, starts_at, ends_at, status_code, location_name, deleted_at')
      .eq('council_id', council.id)
      .order('deleted_at', { ascending: false })
      .returns<DeletedEventArchiveRow[]>(),
  ])

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
              <p className="qv-subtitle">Completed, cancelled, past meetings, and archived events stay visible here for admins.</p>
            </div>
            <div className="qv-directory-actions">
              <Link href="/events" className="qv-link-button qv-button-secondary">
                Back to events
              </Link>
            </div>
          </div>
        </section>

        {completedError || deletedError ? (
          <section className="qv-card qv-error">
            Could not load the event archive. {completedError?.message || deletedError?.message}
          </section>
        ) : (
          <div className="qv-detail-grid">
            <section className="qv-card">
              <div className="qv-directory-section-head">
                <div>
                  <h2 className="qv-section-title">Completed and cancelled</h2>
                  <p className="qv-section-subtitle">Completed events, cancelled events, and past meetings still appear here for reference.</p>
                </div>
              </div>

              {(completedEvents ?? []).length === 0 ? (
                <div className="qv-empty">
                  <h3 className="qv-empty-title">No completed or cancelled events</h3>
                  <p className="qv-empty-text">Completed events and past meetings will appear here automatically.</p>
                </div>
              ) : (
                <div className="qv-member-list">
                  {(completedEvents ?? []).map((event) => (
                    <Link key={event.id} href={`/events/${event.id}`} className="qv-member-link">
                      <article className="qv-member-row">
                        <div style={{ display: 'grid', gap: 6 }}>
                          <div className="qv-member-name">{event.title}</div>
                          <div className="qv-inline-message">{formatDateRange(event.starts_at, event.ends_at)}</div>
                          <div className="qv-inline-message">{event.location_name || 'No location listed'}</div>
                          <div className="qv-inline-message">
                            {getArchiveMetaLabel(event)} • {getArchiveStatusLabel(event)}
                          </div>
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

            <section className="qv-card">
              <div className="qv-directory-section-head">
                <div>
                  <h2 className="qv-section-title">Archived from active events</h2>
                  <p className="qv-section-subtitle">These are snapshots captured when an organizer archived an event.</p>
                </div>
              </div>

              {(deletedEvents ?? []).length === 0 ? (
                <div className="qv-empty">
                  <h3 className="qv-empty-title">No archived events yet</h3>
                  <p className="qv-empty-text">Archived events will appear here after they are removed from the active list.</p>
                </div>
              ) : (
                <div className="qv-member-list">
                  {(deletedEvents ?? []).map((event) => (
                    <Link key={event.id} href={`/events/archive/${event.id}`} className="qv-member-link">
                      <article className="qv-member-row">
                        <div style={{ display: 'grid', gap: 6 }}>
                          <div className="qv-member-name">{event.title}</div>
                          <div className="qv-inline-message">{formatDateRange(event.starts_at, event.ends_at)}</div>
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
