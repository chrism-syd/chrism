import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { decryptPeopleRecord } from '@/lib/security/pii'

type PageProps = {
  params: Promise<{ id: string }>
}

type PersonRow = {
  id: string
  first_name: string
  last_name: string
  nickname: string | null
  email: string | null
  cell_phone: string | null
  home_phone: string | null
  other_phone: string | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state_province: string | null
  postal_code: string | null
  primary_relationship_code: string | null
  council_id: string | null
}

function formatAddress(
  person: Pick<PersonRow, 'address_line_1' | 'address_line_2' | 'city' | 'state_province' | 'postal_code'>
) {
  const line1 = [person.address_line_1, person.address_line_2].filter(Boolean).join(', ')
  const line2 = [person.city, person.state_province, person.postal_code].filter(Boolean).join(', ')
  return [line1, line2].filter(Boolean).join(' • ')
}

export default async function ExternalAdminProfilePage({ params }: PageProps) {
  const { id } = await params
  const { admin: supabase, permissions, council } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/me',
    areaCode: 'admins',
    minimumAccessLevel: 'manage',
  })

  if (!permissions.organizationId) redirect('/me')

  const [{ data: personData, error: personError }, { data: orgAdminRow }, { data: councilAdminRow }, { data: linkedCouncilRow }] = await Promise.all([
    supabase
      .from('people')
      .select(
        'id, first_name, last_name, nickname, email, cell_phone, home_phone, other_phone, address_line_1, address_line_2, city, state_province, postal_code, primary_relationship_code, council_id'
      )
      .eq('id', id)
      .is('archived_at', null)
      .maybeSingle<PersonRow>(),
    supabase
      .from('organization_admin_assignments')
      .select('id')
      .eq('organization_id', permissions.organizationId)
      .eq('person_id', id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('council_admin_assignments')
      .select('id')
      .eq('council_id', council.id)
      .eq('person_id', id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('councils')
      .select('id, name, council_number')
      .limit(200),
  ])

  if (personError) {
    throw new Error(`Could not load admin contact profile. ${personError.message}`)
  }

  if (!personData || (!orgAdminRow && !councilAdminRow)) {
    notFound()
  }

  const person = decryptPeopleRecord(personData)

  if (person.council_id === council.id && person.primary_relationship_code === 'member') {
    redirect(`/members/${person.id}`)
  }

  const linkedCouncil = ((linkedCouncilRow as Array<{ id: string; name: string | null; council_number: string | null }> | null) ?? []).find(
    (row) => row.id === person.council_id
  )

  const address = formatAddress(person)
  const displayName = [person.nickname?.trim() || person.first_name, person.last_name].filter(Boolean).join(' ')

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-detail-hero-main">
            <div className="qv-detail-hero-copy">
              <p className="qv-eyebrow">Organization settings</p>
              <h1 className="qv-title">{displayName}</h1>
              <p className="qv-subtitle">Organization admin contact profile. This person has admin access without being treated as a local member record in this organization.</p>
              <div className="qv-detail-badges">
                <span className="qv-badge">Admin contact</span>
                {orgAdminRow ? <span className="qv-badge qv-badge-soft">Organization assignment</span> : null}
                {councilAdminRow ? <span className="qv-badge qv-badge-soft">Council assignment</span> : null}
              </div>
            </div>
          </div>

          <div className="qv-detail-action-row" style={{ marginTop: 20 }}>
            <div className="qv-detail-actions">
              <Link href="/me/council" className="qv-button-secondary qv-link-button">
                Back to organization settings
              </Link>
            </div>
          </div>
        </section>

        <section className="qv-detail-grid">
          <div className="qv-detail-stack">
            <section className="qv-card">
              <h2 className="qv-section-title">Contact</h2>
              <p className="qv-section-subtitle">Current contact information for this admin assignment.</p>

              <div className="qv-detail-list">
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Email</div>
                  <div className="qv-detail-value">{person.email || 'No email on file'}</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Cell phone</div>
                  <div className="qv-detail-value">{person.cell_phone || 'Not set'}</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Home phone</div>
                  <div className="qv-detail-value">{person.home_phone || 'Not set'}</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Other phone</div>
                  <div className="qv-detail-value">{person.other_phone || 'Not set'}</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Address</div>
                  <div className="qv-detail-value">{address || 'No address on file'}</div>
                </div>
              </div>
            </section>
          </div>

          <div className="qv-detail-stack">
            <section className="qv-card">
              <h2 className="qv-section-title">Admin access context</h2>
              <p className="qv-section-subtitle">This profile is for admin access visibility, not for treating the person as a local member.</p>

              <div className="qv-detail-list">
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Local member record in this organization</div>
                  <div className="qv-detail-value">No</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Relationship in this view</div>
                  <div className="qv-detail-value">External admin contact</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Linked home council</div>
                  <div className="qv-detail-value">
                    {linkedCouncil
                      ? `${linkedCouncil.name ?? 'Council'}${linkedCouncil.council_number ? ` (${linkedCouncil.council_number})` : ''}`
                      : 'Not linked to a council member record here'}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}
