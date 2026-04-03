import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { assertCanManageEventsInContext } from '@/lib/auth/area-access'
import EventCard from './event-card'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

type EventRow = {
  id: string
  title: string
  description: string | null
  event_kind_code: string | null
  starts_at: string
  ends_at: string | null
  scope_code: string | null
  location_name: string | null
  rsvp_mode_code: string | null
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const permissions = await getCurrentUserPermissions()
  const admin = createAdminClient()
  const filter = firstString(params.filter)

  if (!permissions.canManageEvents) {
    redirect('/me')
  }

  const context = await getCurrentActingCouncilContext({
    permissions,
    supabaseAdmin: admin,
    requireAdmin: false,
    redirectTo: '/me',
    requireArea: { area: 'events', level: 'manage' },
  })

  await assertCanManageEventsInContext({
    admin,
    permissions,
    localUnitId: context.localUnitId,
    redirectTo: '/me',
  })

  let query = admin
    .from('events')
    .select(
      'id, title, description, event_kind_code, starts_at, ends_at, scope_code, location_name, rsvp_mode_code'
    )
    .eq('council_id', context.council.id)
    .order('starts_at', { ascending: true })

  if (filter === 'upcoming') {
    query = query.gte('starts_at', new Date().toISOString())
  }

  const { data } = await query
  const events = (data as EventRow[] | null) ?? []

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <p className="qv-eyebrow">Events</p>
          <h1 className="qv-title">Events for {context.council.name}</h1>
          <p className="qv-subtitle">
            Plan meetings, invite councils, and manage volunteer or RSVP flows.
          </p>

          <div className="qv-form-actions" style={{ marginTop: 20 }}>
            <Link href="/events/new" className="qv-link-button qv-button-primary">
              New event
            </Link>
            <Link href="/events/archive" className="qv-link-button qv-button-secondary">
              Archived events
            </Link>
          </div>
        </section>

        <div className="qv-section-menu-shell" style={{ marginTop: 24 }}>
          <div className="qv-section-menu-inner">
            <Link
              href="/events"
              className={`qv-section-menu-link${!filter ? ' is-active' : ''}`}
            >
              All events
            </Link>
            <Link
              href="/events?filter=upcoming"
              className={`qv-section-menu-link${filter === 'upcoming' ? ' is-active' : ''}`}
            >
              Upcoming
            </Link>
          </div>
        </div>

        <section className="qv-grid" style={{ marginTop: 24 }}>
          {events.length === 0 ? (
            <div className="qv-empty qv-card" style={{ gridColumn: '1 / -1' }}>
              <p className="qv-empty-text">No events found for this view yet.</p>
            </div>
          ) : (
            events.map((event) => <EventCard key={event.id} event={event} />)
          )}
        </section>
      </div>
    </main>
  )
}
