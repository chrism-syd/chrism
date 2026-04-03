import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import AppHeader from '@/app/app-header'
import EventForm from '../event-form'
import { createEvent } from '../actions'

type OrganizationRow = {
  id: string
  display_name: string | null
  preferred_name: string | null
}

export default async function NewEventPage() {
  const { admin, council } = await getCurrentActingCouncilContext({
    redirectTo: '/events',
    areaCode: 'events',
    minimumAccessLevel: 'manage',
  })

  let organization: OrganizationRow | null = null
  if (council.organization_id) {
    const { data } = await admin.from('organizations').select('id, display_name, preferred_name').eq('id', council.organization_id).single()
    organization = (data as OrganizationRow | null) ?? null
  }

  const heroName = organization?.preferred_name ?? organization?.display_name ?? council.name ?? 'Council'

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />
        <section className="qv-hero-card">
          <div className="qv-hero-top">
            <div>
              <p className="qv-eyebrow">{heroName}{council.council_number ? ` (${council.council_number})` : ''}</p>
              <h1 className="qv-title">New event</h1>
              <p className="qv-subtitle">Create a scheduled event now or save it as a draft for later.</p>
            </div>
          </div>
        </section>

        <EventForm
          mode="create"
          action={createEvent}
          cancelHref="/events"
          submitLabel="Create Event"
          initialValues={{
            scope_code: 'home_council_only',
            event_kind_code: 'standard',
            requires_rsvp: false,
            needs_volunteers: false,
            reminder_enabled: false,
            invited_councils: [{ invited_council_name: '', invited_council_number: '', invite_email: '', invite_contact_name: '' }],
            external_invitees: [{ invitee_name: '', invitee_email: '', invitee_phone: '', invitee_role_label: '', invitee_notes: '' }],
          }}
        />
      </div>
    </main>
  )
}
