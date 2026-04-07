import AppHeader from '@/app/app-header'
import OrganizationAvatar from '@/app/components/organization-avatar'
import SectionMenuBar from '@/app/components/section-menu-bar'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { listAccessibleLocalUnitsForArea } from '@/lib/auth/area-access'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import EventForm from '../event-form'
import { createEvent } from '../actions'

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

export default async function NewEventPage() {
  const context = await getCurrentActingCouncilContext({
    redirectTo: '/events',
    areaCode: 'events',
    minimumAccessLevel: 'manage',
  })

  const { admin, council, permissions, localUnitId } = context

  let organization: OrganizationRow | null = null
  if (council.organization_id) {
    const { data } = await admin
      .from('organizations')
      .select('id, display_name, preferred_name, org_type_code, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)')
      .eq('id', council.organization_id)
      .single()
    organization = (data as OrganizationRow | null) ?? null
  }

  const switchableLocalUnits = permissions.authUser
    ? (
        await listAccessibleLocalUnitsForArea({
          admin,
          userId: permissions.authUser.id,
          areaCode: 'events',
          minimumAccessLevel: 'manage',
        })
      )
        .filter((unit) => unit.local_unit_id !== localUnitId)
        .sort((left, right) => left.local_unit_name.localeCompare(right.local_unit_name))
    : []

  const organizationName = getEffectiveOrganizationName(organization) ?? council.name ?? 'Organization'
  const effectiveBranding = getEffectiveOrganizationBranding(organization)
  const currentCouncilLabel = `${council.name ?? organizationName}${council.council_number ? ` (${council.council_number})` : ''}`

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

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
                          <input type="hidden" name="next" value="/events/new" />
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

        <SectionMenuBar
          items={[
            { label: 'Events', href: '/events' },
            { label: 'Archived events', href: '/events/archive' },
          ]}
        />

        <section className="qv-card" style={{ marginBottom: 20 }}>
          <div className="qv-directory-section-head">
            <div>
              <h1 className="qv-section-title" style={{ marginBottom: 8 }}>Add event</h1>
              <p className="qv-section-subtitle">Create a scheduled event now or save it as a draft for later.</p>
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
            organizationTypeCode: organization?.org_type_code ?? null,
            invited_councils: [{ invited_council_name: '', invited_council_number: '', invite_email: '', invite_contact_name: '' }],
            external_invitees: [{ invitee_name: '', invitee_email: '', invitee_phone: '', invitee_role_label: '', invitee_notes: '' }],
          }}
        />
      </div>
    </main>
  )
}
