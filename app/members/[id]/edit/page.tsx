import AppHeader from '@/app/app-header'
import MemberForm from '../../member-form'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { decryptPeopleRecord } from '@/lib/security/pii'

type PageProps = { params: Promise<{ id: string }> }

export default async function EditMemberPage({ params }: PageProps) {
  const { id } = await params
  const { admin: supabase, council } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/members',
  })

  const { data: personData } = await supabase
    .from('people')
    .select(
      'id, first_name, last_name, email, cell_phone, home_phone, other_phone, address_line_1, address_line_2, city, state_province, postal_code, council_activity_level_code, council_activity_context_code, council_reengagement_status_code'
    )
    .eq('id', id)
    .eq('council_id', council.id)
    .eq('primary_relationship_code', 'member')
    .is('archived_at', null)
    .maybeSingle()

  const person = personData ? decryptPeopleRecord(personData) : null

  if (!person) return null

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <p className="qv-eyebrow">Member Directory</p>
          <h1 className="qv-title">Edit member</h1>
          <p className="qv-subtitle">
            Update local organization-managed information for {person.first_name} {person.last_name}.
          </p>
        </section>

        <section className="qv-card">
          <MemberForm
            mode="edit"
            cancelHref={`/members/${person.id}`}
            initialValues={{
              member_id: person.id,
              first_name: person.first_name ?? '',
              last_name: person.last_name ?? '',
              email: person.email ?? '',
              cell_phone: person.cell_phone ?? '',
              home_phone: person.home_phone ?? '',
              other_phone: person.other_phone ?? '',
              address_line_1: person.address_line_1 ?? '',
              address_line_2: person.address_line_2 ?? '',
              city: person.city ?? '',
              state_province: person.state_province ?? '',
              postal_code: person.postal_code ?? '',
              council_activity_level_code: person.council_activity_level_code ?? '',
              council_activity_context_code: person.council_activity_context_code ?? '',
              council_reengagement_status_code: person.council_reengagement_status_code ?? '',
            }}
          />
        </section>
      </div>
    </main>
  )
}
