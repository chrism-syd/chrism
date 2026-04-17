import { notFound } from 'next/navigation'
import AppHeader from '@/app/app-header'
import MemberForm from '../../member-form'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { listValidDirectoryPersonIdsForLocalUnit } from '@/lib/custom-lists'
import { decryptPeopleRecord } from '@/lib/security/pii'

type PageProps = { params: Promise<{ id: string }> }

type PersonRow = {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
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
  council_activity_level_code: string | null
  council_activity_context_code: string | null
  council_reengagement_status_code: string | null
}

function formatFullName(person: Pick<PersonRow, 'first_name' | 'middle_name' | 'last_name'>) {
  return [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ')
}

async function findScopedLocalUnitIdsForPerson(args: {
  supabase: any
  personId: string
}) {
  const { data, error } = await args.supabase
    .from('local_unit_people')
    .select('local_unit_id')
    .eq('person_id', args.personId)
    .is('ended_at', null)

  if (error) {
    throw new Error(`Could not load local-unit scope for this person. ${error.message}`)
  }

  return [
    ...new Set(
      ((data as Array<{ local_unit_id: string | null }> | null) ?? [])
        .map((row) => row.local_unit_id)
        .filter((value): value is string => Boolean(value))
    ),
  ]
}

export default async function EditMemberPage({ params }: PageProps) {
  const { id } = await params
  const actingContext = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/members',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  })

  const { admin: supabase } = actingContext

  const scopedLocalUnitIds = await findScopedLocalUnitIdsForPerson({
    supabase,
    personId: id,
  }).catch(() => [])

  const preferredLocalUnitId =
    (actingContext.localUnitId && scopedLocalUnitIds.includes(actingContext.localUnitId)
      ? actingContext.localUnitId
      : null) ??
    scopedLocalUnitIds[0] ??
    actingContext.localUnitId

  if (!preferredLocalUnitId) {
    notFound()
  }

  const validPersonIds = await listValidDirectoryPersonIdsForLocalUnit({
    admin: supabase,
    localUnitId: preferredLocalUnitId,
    personIds: [id],
  }).catch(() => [])

  if (!validPersonIds.includes(id)) {
    notFound()
  }

  const { data: personData } = await supabase
    .from('people')
    .select(
      'id, first_name, middle_name, last_name, email, cell_phone, home_phone, other_phone, address_line_1, address_line_2, city, state_province, postal_code, primary_relationship_code, council_activity_level_code, council_activity_context_code, council_reengagement_status_code'
    )
    .eq('id', id)
    .is('archived_at', null)
    .maybeSingle<PersonRow>()

  const person = personData ? decryptPeopleRecord(personData) : null

  if (!person) notFound()

  const personName = formatFullName(person)

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section style={{ display: 'grid', gap: 14, marginTop: 12, marginBottom: 18 }}>
          <h1
            className="qv-directory-name"
            style={{
              margin: 0,
              fontSize: 'clamp(42px, 6.4vw, 68px)',
              lineHeight: 0.96,
              letterSpacing: '-0.04em',
              whiteSpace: 'nowrap',
            }}
          >
            Edit Person
          </h1>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.35, color: 'var(--text-secondary)' }}>
            Update local organization-managed information for {personName}.
          </p>
        </section>

        <section className="qv-card">
          <MemberForm
            mode="edit"
            cancelHref={`/members/${person.id}`}
            initialValues={{
              member_id: person.id,
              primary_relationship_code: person.primary_relationship_code ?? 'member',
              first_name: person.first_name ?? '',
              middle_name: person.middle_name ?? '',
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
