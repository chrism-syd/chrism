import Link from 'next/link'
import AppHeader from '@/app/app-header'
import MemberOfficerServiceSection from '@/app/members/member-officer-service-section'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { type OfficerTermRow } from '@/lib/members/officer-roles'

type PageProps = { params: Promise<{ id: string }> }

type PersonRow = {
  id: string
  first_name: string
  last_name: string
}

export default async function MemberOfficerTermsPage({ params }: PageProps) {
  const { id } = await params
  const { admin: supabase, council } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/members',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  })

  const { data: person } = await supabase
    .from('people')
    .select('id, first_name, last_name')
    .eq('id', id)
    .eq('council_id', council.id)
    .eq('primary_relationship_code', 'member')
    .maybeSingle<PersonRow>()

  if (!person) {
    return null
  }

  const { data: officerTerms } = await supabase
    .from('person_officer_terms')
    .select('id, office_scope_code, office_code, office_label, office_rank, service_start_year, service_end_year, notes')
    .eq('person_id', person.id)
    .eq('council_id', council.id)
    .order('service_start_year', { ascending: false })
    .returns<OfficerTermRow[]>()

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-hero-top">
            <div>
              <p className="qv-eyebrow">Member directory</p>
              <h1 className="qv-title">Officer history</h1>
              <p className="qv-subtitle">
                Add role service years for {person.first_name} {person.last_name}.
              </p>
            </div>
            <div className="qv-top-actions">
              <Link href={`/members/${person.id}`} className="qv-link-button qv-button-secondary">
                Back to member
              </Link>
            </div>
          </div>
        </section>

        <MemberOfficerServiceSection
          person={person}
          terms={officerTerms ?? []}
          returnTo={`/members/${person.id}/officers`}
        />
      </div>
    </main>
  )
}
