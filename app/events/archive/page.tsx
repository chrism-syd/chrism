import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import ConfirmActionButton from '@/app/components/confirm-action-button'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { restoreArchivedEventAction } from '../actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ArchivedEventsPage() {
  const permissions = await getCurrentUserPermissions()

  if (!permissions.canManageEvents) {
    redirect('/me')
  }

  const admin = createAdminClient()
  const context = await getCurrentActingCouncilContext({
    permissions,
    supabaseAdmin: admin,
    requireAdmin: false,
    redirectTo: '/me',
    requireArea: { area: 'events', level: 'manage' },
  })

  const { data: archives } = await admin
    .from('event_archives')
    .select('id, title, description, event_kind_code, starts_at, ends_at, deleted_at')
    .eq('council_id', context.council.id)
    .order('deleted_at', { ascending: false })

  const archivedEvents =
    (archives as Array<{
      id: string
      title: string
      description: string | null
      event_kind_code: string | null
      starts_at: string
      ends_at: string | null
      deleted_at: string
    }> | null) ?? []

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <p className="qv-eyebrow">Archived events</p>
          <h1 className="qv-title">Restore deleted events</h1>
          <p className="qv-subtitle">
            Review recently archived events for {context.council.name}. Restoring an event moves it back into the main events list.
          </p>
          <div className="qv-form-actions" style={{ marginTop: 20 }}>
            <Link href="/events" className="qv-link-button qv-button-secondary">
              Back to events
            </Link>
          </div>
        </section>

        <section className="qv-card" style={{ marginTop: 24 }}>
          {archivedEvents.length === 0 ? (
            <div className="qv-empty">
              <p className="qv-empty-text">No archived events right now.</p>
            </div>
          ) : (
            <div className="qv-member-list">
              {archivedEvents.map((event) => {
                const eventDate = new Intl.DateTimeFormat('en-CA', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(new Date(event.starts_at))

                const deletedDate = new Intl.DateTimeFormat('en-CA', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(new Date(event.deleted_at))

                return (
                  <article key={event.id} className="qv-member-row qv-member-row-compact">
                    <div className="qv-member-text">
                      <div className="qv-member-name qv-member-name-tight">{event.title}</div>
                      <div className="qv-member-meta qv-member-meta-tight">
                        {event.event_kind_code ?? 'event'} · {eventDate}
                      </div>
                      {event.description ? <div className="qv-member-meta qv-member-meta-tight">{event.description}</div> : null}
                      <div className="qv-member-meta qv-member-meta-tight">Archived {deletedDate}</div>
                    </div>
                    <div className="qv-member-row-right">
                      <ConfirmActionButton
                        triggerLabel="Restore"
                        confirmTitle="Restore this event?"
                        confirmDescription="This will move the event back into your live events list."
                        confirmLabel="Restore event"
                        action={restoreArchivedEventAction}
                        hiddenFields={[{ name: 'archive_id', value: event.id }]}
                      />
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
