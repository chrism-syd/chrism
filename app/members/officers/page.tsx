import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import ConfirmActionButton from '@/app/components/confirm-action-button'
import MemberSearchField from '@/app/components/member-search-field'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import {
  addOfficerRoleAction,
  removeOfficerRoleAction,
} from './actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type OfficerRoleOption = {
  value: string
  label: string
}

const OFFICER_ROLES: OfficerRoleOption[] = [
  { value: 'grand_knight', label: 'Grand Knight' },
  { value: 'deputy_grand_knight', label: 'Deputy Grand Knight' },
  { value: 'chancellor', label: 'Chancellor' },
  { value: 'warden', label: 'Warden' },
  { value: 'financial_secretary', label: 'Financial Secretary' },
  { value: 'treasurer', label: 'Treasurer' },
  { value: 'advocate', label: 'Advocate' },
  { value: 'recorder', label: 'Recorder' },
  { value: 'inside_guard', label: 'Inside Guard' },
  { value: 'outside_guard', label: 'Outside Guard' },
]

type PersonRow = {
  id: string
  first_name: string
  last_name: string
}

type OfficerTermRow = {
  id: string
  person_id: string
  office_code: string
  office_label: string | null
  service_start_year: number
  service_end_year: number | null
}

function displayName(person: PersonRow) {
  return `${person.first_name} ${person.last_name}`.trim()
}

export default async function OfficersPage() {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.canAccessOfficerDirectory) {
    redirect('/me')
  }

  const admin = createAdminClient()
  const context = await getCurrentActingCouncilContext({
    permissions,
    supabaseAdmin: admin,
    requireAdmin: false,
    redirectTo: '/me',
    requireArea: { area: 'members', level: 'edit_manage' },
  })

  const [{ data: peopleData }, { data: officerData }] = await Promise.all([
    admin
      .from('people')
      .select('id, first_name, last_name')
      .eq('council_id', context.council.id)
      .eq('primary_relationship_code', 'member')
      .is('archived_at', null)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true }),
    admin
      .from('person_officer_terms')
      .select('id, person_id, office_code, office_label, service_start_year, service_end_year')
      .eq('council_id', context.council.id)
      .is('service_end_year', null)
      .order('service_start_year', { ascending: false }),
  ])

  const people = (peopleData as PersonRow[] | null) ?? []
  const officers = (officerData as OfficerTermRow[] | null) ?? []
  const peopleById = new Map(people.map((person) => [person.id, person]))

  const memberOptions = people.map((person) => ({
    id: person.id,
    label: displayName(person),
  }))

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <p className="qv-eyebrow">Officer directory</p>
          <h1 className="qv-title">Current officers for {context.council.name}</h1>
          <p className="qv-subtitle">
            Keep the officer roster current so the admin package and event responsibilities stay accurate.
          </p>
          <div className="qv-form-actions" style={{ marginTop: 20 }}>
            <Link href="/members" className="qv-link-button qv-button-secondary">
              Back to members
            </Link>
          </div>
        </section>

        <section className="qv-card" style={{ marginTop: 24 }}>
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Add officer role</h2>
              <p className="qv-section-subtitle">
                Assign a member to one of the current officer positions.
              </p>
            </div>
          </div>

          <form action={addOfficerRoleAction} className="qv-form-grid">
            <MemberSearchField
              name="person_id"
              label="Member"
              members={memberOptions}
              placeholder="Start typing a member name"
              required
            />

            <label className="qv-control">
              <span className="qv-label">Role</span>
              <select name="office_code" required defaultValue="grand_knight">
                {OFFICER_ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="qv-control">
              <span className="qv-label">Service start year</span>
              <input
                name="service_start_year"
                type="number"
                min={1900}
                max={3000}
                defaultValue={new Date().getFullYear()}
                required
              />
            </label>

            <div className="qv-form-actions">
              <button type="submit" className="qv-button-primary">
                Add officer
              </button>
            </div>
          </form>
        </section>

        <section className="qv-card" style={{ marginTop: 24 }}>
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Current roster</h2>
              <p className="qv-section-subtitle">
                Active officer assignments for this council.
              </p>
            </div>
          </div>

          {officers.length === 0 ? (
            <div className="qv-empty">
              <p className="qv-empty-text">No officers assigned yet.</p>
            </div>
          ) : (
            <div className="qv-member-list">
              {officers.map((officer) => {
                const person = peopleById.get(officer.person_id)
                return (
                  <article key={officer.id} className="qv-member-row qv-member-row-compact">
                    <div className="qv-member-text">
                      <div className="qv-member-name qv-member-name-tight">
                        {officer.office_label ?? officer.office_code}
                      </div>
                      <div className="qv-member-meta qv-member-meta-tight">
                        {person ? displayName(person) : 'Unknown member'} · serving since {officer.service_start_year}
                      </div>
                    </div>
                    <div className="qv-member-row-right">
                      <ConfirmActionButton
                        triggerLabel="End term"
                        confirmTitle="End this officer term?"
                        confirmDescription="This ends the current officer assignment and removes any automatic admin package that depends on it."
                        confirmLabel="End term"
                        danger
                        action={removeOfficerRoleAction}
                        hiddenFields={[{ name: 'term_id', value: officer.id }]}
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
