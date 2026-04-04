import { notFound } from 'next/navigation'
import { getCurrentActingCouncilContextForEvent } from '@/lib/auth/acting-context'
import AppHeader from '@/app/app-header'
import EventForm from '../../event-form'
import DeleteEventButton from '../../delete-event-button'
import { deleteEvent, updateEvent } from '../../actions'

type EditEventPageProps = {
  params: Promise<{ id: string }>
}

type OrganizationRow = {
  id: string
  display_name: string | null
  preferred_name: string | null
  org_type_code: string | null
}

type InvitedCouncilRow = {
  id: string
  is_host: boolean
  invited_council_name: string
  invited_council_number: string | null
  invite_email: string | null
  invite_contact_name: string | null
  sort_order: number
}

type ExternalInviteeRow = {
  id: string
  invitee_name: string
  invitee_email: string | null
  invitee_phone: string | null
  invitee_role_label: string | null
  notes: string | null
  sort_order: number
}

export default async function EditEventPage({ params }: EditEventPageProps) {
  const { id } = await params
  const { admin: supabase, council } = await getCurrentActingCouncilContextForEvent({ eventId: id, redirectTo: '/events' })

  let organization: OrganizationRow | null = null
  if (council.organization_id) {
    const { data } = await supabase
      .from('organizations')
      .select('id, display_name, preferred_name, org_type_code')
      .eq('id', council.organization_id)
      .single()
    organization = (data as OrganizationRow | null) ?? null
  }

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      'id, council_id, title, description, location_name, location_address, starts_at, ends_at, status_code, scope_code, event_kind_code, requires_rsvp, needs_volunteers, rsvp_deadline_at, reminder_enabled, reminder_scheduled_for'
    )
    .eq('id', id)
    .eq('council_id', council.id)
    .single()

  if (eventError || !event) notFound()

  const { data: invitedCouncils, error: invitedCouncilsError } = await supabase
    .from('event_invited_councils')
    .select('id, is_host, invited_council_name, invited_council_number, invite_email, invite_contact_name, sort_order')
    .eq('event_id', event.id)
    .order('sort_order', { ascending: true })
    .returns<InvitedCouncilRow[]>()

  if (invitedCouncilsError) {
    return <main className="qv-page"><div className="qv-shell"><AppHeader /><section className="qv-card qv-error">Could not load invited councils for this event.</section></div></main>
  }

  const { data: externalInvitees, error: externalInviteesError } = await supabase
    .from('event_external_invitees')
    .select('id, invitee_name, invitee_email, invitee_phone, invitee_role_label, notes, sort_order')
    .eq('event_id', event.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .returns<ExternalInviteeRow[]>()

  if (externalInviteesError) {
    return <main className="qv-page"><div className="qv-shell"><AppHeader /><section className="qv-card qv-error">Could not load external invitees for this event.</section></div></main>
  }

  const nonHostInvitedCouncils = invitedCouncils?.filter((row) => !row.is_host).map((row) => ({
    invited_council_name: row.invited_council_name ?? '',
    invited_council_number: row.invited_council_number ?? '',
    invite_email: row.invite_email ?? '',
    invite_contact_name: row.invite_contact_name ?? '',
  })) ?? []

  const initialExternalInvitees = externalInvitees?.map((row) => ({
    invitee_name: row.invitee_name ?? '',
    invitee_email: row.invitee_email ?? '',
    invitee_phone: row.invitee_phone ?? '',
    invitee_role_label: row.invitee_role_label ?? '',
    invitee_notes: row.notes ?? '',
  })) ?? []

  const updateEventAction = updateEvent.bind(null, event.id)
  const deleteEventAction = deleteEvent.bind(null, event.id)
  const heroName = organization?.preferred_name ?? organization?.display_name ?? council.name ?? 'Council'

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />
        <section className="qv-hero-card">
          <div className="qv-hero-top">
            <div>
              <p className="qv-eyebrow">{heroName}{council.council_number ? ` (${council.council_number})` : ''}</p>
              <h1 className="qv-title">Edit event</h1>
              <p className="qv-subtitle">Update event details, RSVP settings, invitees, and automated email reminders.</p>
            </div>
          </div>
        </section>

        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <DeleteEventButton action={deleteEventAction} />
        </div>

        <EventForm
          mode="edit"
          action={updateEventAction}
          cancelHref={`/events/${event.id}`}
          submitLabel="Save changes"
          initialValues={{
            title: event.title,
            description: event.description ?? '',
            location_name: event.location_name ?? '',
            location_address: event.location_address ?? '',
            starts_at: event.starts_at,
            ends_at: event.ends_at,
            status_code: event.status_code,
            scope_code: event.scope_code,
            event_kind_code: event.event_kind_code,
            requires_rsvp: event.requires_rsvp,
            needs_volunteers: event.needs_volunteers,
            rsvp_deadline_at: event.rsvp_deadline_at,
            reminder_enabled: event.reminder_enabled,
            reminder_scheduled_for: event.reminder_scheduled_for,
            organizationTypeCode: organization?.org_type_code ?? null,
            invited_councils: nonHostInvitedCouncils.length > 0 ? nonHostInvitedCouncils : [emptyInvite()],
            external_invitees: initialExternalInvitees.length > 0 ? initialExternalInvitees : [emptyExternalInvitee()],
          }}
        />
      </div>
    </main>
  )
}

function emptyInvite() {
  return {
    invited_council_name: '',
    invited_council_number: '',
    invite_email: '',
    invite_contact_name: '',
  }
}

function emptyExternalInvitee() {
  return {
    invitee_name: '',
    invitee_email: '',
    invitee_phone: '',
    invitee_role_label: '',
    invitee_notes: '',
  }
}
