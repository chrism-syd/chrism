import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { duplicateArchivedEventAsDraft } from '../../actions'
import { formatEventDateTimeRange } from '@/lib/events/display'

type ArchivedEventRow = {
  id: string
  original_event_id: string | null
  council_id: string
  local_unit_id?: string | null
  title: string
  description: string | null
  location_name: string | null
  location_address: string | null
  starts_at: string | null
  ends_at: string | null
  status_code: string | null
  scope_code: string | null
  event_kind_code: string | null
  requires_rsvp: boolean
  rsvp_deadline_at: string | null
  reminder_enabled: boolean
  reminder_scheduled_for: string | null
  reminder_days_before: number | null
  deleted_at: string
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function getStatusLabel(statusCode?: string | null) {
  if (statusCode === 'draft') return 'Draft'
  if (statusCode === 'completed') return 'Completed'
  if (statusCode === 'cancelled') return 'Cancelled'
  if (statusCode === 'scheduled') return 'Scheduled'
  return 'Archived'
}

export default async function ArchivedEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { admin: supabase, council, localUnitId } = await getCurrentActingCouncilContext({
    redirectTo: '/events/archive',
    areaCode: 'events',
    minimumAccessLevel: 'manage',
  })

  const { data, error } = await supabase
    .from('event_archives')
    .select(
      'id, original_event_id, council_id, local_unit_id, title, description, location_name, location_address, starts_at, ends_at, status_code, scope_code, event_kind_code, requires_rsvp, rsvp_deadline_at, reminder_enabled, reminder_scheduled_for, reminder_days_before, deleted_at'
    )
    .eq('id', id)
    .eq(localUnitId ? 'local_unit_id' : 'council_id', localUnitId ?? council.id)
    .single()

  const event = data as ArchivedEventRow | null

  if (error || !event) {
    notFound()
  }

  const duplicateAction = duplicateArchivedEventAsDraft.bind(null, event.id)

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
              <h1 className="qv-title">{event.title}</h1>
              <p className="qv-subtitle">{formatEventDateTimeRange(event.starts_at, event.ends_at)}</p>
              <div className="qv-detail-badges">
                <span className="qv-badge">{getStatusLabel(event.status_code)}</span>
                <span className="qv-badge">Archived</span>
                <span className="qv-badge">{event.requires_rsvp ? 'RSVP required' : 'No RSVP'}</span>
              </div>
            </div>
            <div className="qv-detail-actions">
              <Link href="/events/archive" className="qv-link-button qv-button-secondary">
                Back to archive
              </Link>
              <form action={duplicateAction}>
                <button type="submit" className="qv-button-primary">
                  Duplicate as draft
                </button>
              </form>
            </div>
          </div>
        </section>

        <div className="qv-detail-grid">
          <section className="qv-card">
            <div className="qv-directory-section-head">
              <div>
                <h2 className="qv-section-title">Event details</h2>
                <p className="qv-section-subtitle">Snapshot of the event at the moment it was archived.</p>
              </div>
            </div>
            <div className="qv-detail-list">
              <div className="qv-detail-item">
                <div className="qv-detail-label">When</div>
                <div className="qv-detail-value">{formatEventDateTimeRange(event.starts_at, event.ends_at)}</div>
              </div>
              <div className="qv-detail-item">
                <div className="qv-detail-label">Location</div>
                <div className="qv-detail-value">
                  {[event.location_name, event.location_address].filter(Boolean).join(' • ') || '—'}
                </div>
              </div>
              <div className="qv-detail-item">
                <div className="qv-detail-label">RSVP deadline</div>
                <div className="qv-detail-value">{formatDateTime(event.rsvp_deadline_at)}</div>
              </div>
              <div className="qv-detail-item">
                <div className="qv-detail-label">Reminder email</div>
                <div className="qv-detail-value">{event.reminder_enabled ? 'Enabled' : 'Off'}</div>
              </div>
              <div className="qv-detail-item">
                <div className="qv-detail-label">Reminder send time</div>
                <div className="qv-detail-value">{formatDateTime(event.reminder_scheduled_for)}</div>
              </div>
              <div className="qv-detail-item">
                <div className="qv-detail-label">Archived at</div>
                <div className="qv-detail-value">{formatDateTime(event.deleted_at)}</div>
              </div>
            </div>
          </section>

          <section className="qv-card">
            <div className="qv-directory-section-head">
              <div>
                <h2 className="qv-section-title">Description</h2>
              </div>
            </div>
            {event.description?.trim() ? (
              <div className="qv-detail-value">{event.description}</div>
            ) : (
              <div className="qv-empty">
                <h3 className="qv-empty-title">No description saved</h3>
                <p className="qv-empty-text">This archived snapshot did not include additional description text.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}