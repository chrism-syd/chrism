import { unstable_noStore as noStore } from 'next/cache'
import { notFound } from 'next/navigation'
import OrganizationAvatar from '@/app/components/organization-avatar'
import { getCurrentActingCouncilContextForEvent } from '@/lib/auth/acting-context'
import AppHeader from '@/app/app-header'
import EventForm from '../../event-form'
import DeleteEventButton from '../../delete-event-button'
import { deleteEvent, updateEvent } from '../../actions'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'

type EditEventPageProps = {
  params: Promise<{ id: string }>
}

type OrganizationRow = {
  id: string
  display_name: string | null
  preferred_name: string | null
  org_type_code: string | null
  logo_storage_path?: string | null
  logo_alt_text?: string | null
  brand_profile?: {
    code: string | null
    display_name: string | null
    logo_storage_bucket: string | null
    logo_storage_path: string | null
    logo_alt_text: string | null
  } | null
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

type EventRow = {
  id: string
  local_unit_id: string | null
  council_id: string
  title: string
  description: string | null
  location_name: string | null
  location_address: string | null
  starts_at: string
  ends_at: string | null
  status_code: 'draft' | 'scheduled' | 'completed' | 'cancelled'
  scope_code: 'home_council_only' | 'multi_council'
  event_kind_code: 'standard' | 'general_meeting' | 'executive_meeting'
  requires_rsvp: boolean
  needs_volunteers: boolean
  rsvp_deadline_at: string | null
  volunteer_deadline_at: string | null
  reminder_enabled: boolean
  reminder_scheduled_for: string | null
}

function toDateOnlyValue(value?: string | null) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const day = parts.find((part) => part.type === 'day')?.value ?? ''

  return year && month && day ? `${year}-${month}-${day}` : ''
}

export default async function EditEventPage({ params }: EditEventPageProps) {
  noStore()
  const { id } = await params
  const { admin: supabase, council, localUnitId } = await getCurrentActingCouncilContextForEvent({ eventId: id, redirectTo: '/events' })

  let organization: OrganizationRow | null = null
  if (council.organization_id) {
    const { data } = await supabase
      .from('organizations')
      .select('id, display_name, preferred_name, org_type_code, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)')
      .eq('id', council.organization_id)
      .single()
    organization = (data as OrganizationRow | null) ?? null
  }

  let eventQuery = supabase
    .from('events')
    .select(
      'id, local_unit_id, council_id, title, description, location_name, location_address, starts_at, ends_at, status_code, scope_code, event_kind_code, requires_rsvp, needs_volunteers, rsvp_deadline_at, volunteer_deadline_at, reminder_enabled, reminder_scheduled_for'
    )
    .eq('id', id)

  eventQuery = localUnitId
    ? eventQuery.eq('local_unit_id', localUnitId)
    : eventQuery.eq('council_id', council.id)

  let { data: eventData, error: eventError } = await eventQuery.single()

  if ((eventError || !eventData) && localUnitId) {
    const fallback = await supabase
      .from('events')
      .select(
        'id, local_unit_id, council_id, title, description, location_name, location_address, starts_at, ends_at, status_code, scope_code, event_kind_code, requires_rsvp, needs_volunteers, rsvp_deadline_at, volunteer_deadline_at, reminder_enabled, reminder_scheduled_for'
      )
      .eq('id', id)
      .eq('council_id', council.id)
      .single()

    eventData = fallback.data
    eventError = fallback.error
  }

  const event = eventData as EventRow | null

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
  const organizationName = getEffectiveOrganizationName(organization) ?? heroName
  const effectiveBranding = getEffectiveOrganizationBranding(organization)

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />
        <section className="qv-hero-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              <p className="qv-eyebrow">{heroName}{council.council_number ? ` (${council.council_number})` : ''}</p>
              <h1 className="qv-directory-name">Events</h1>
              <p className="qv-section-subtitle" style={{ maxWidth: 620 }}>
                Update event details, RSVP settings, invitees, and automated email reminders.
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

          <div className="qv-section-menu-shell" style={{ marginTop: 24 }}>
            <div className="qv-section-menu-row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <p className="qv-section-menu-label">Edit event</p>
                <p className="qv-section-menu-value">Refine timing, participation settings, and messaging before members see changes.</p>
              </div>
              <DeleteEventButton action={deleteEventAction} />
            </div>
          </div>
        </section>

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
            rsvp_deadline_at: toDateOnlyValue(event.rsvp_deadline_at),
            volunteer_deadline_at: toDateOnlyValue(event.volunteer_deadline_at),
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
