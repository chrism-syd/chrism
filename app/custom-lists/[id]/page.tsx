import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import ConfirmActionButton from '@/app/components/confirm-action-button'
import CustomListDetailClient from '@/app/custom-lists/[id]/detail-client'
import { archiveCustomListAction } from '@/app/custom-lists/actions'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import {
  canManageCustomList,
  canViewCustomList,
  hasStrictCustomListLifecycleAccess,
  listActiveCustomListShares,
  listValidMemberPeopleForLocalUnit,
  resolveCustomListLocalUnitId,
  type CustomListMemberRow,
  type CustomListRow,
  type CustomListShareGrantRow,
} from '@/lib/custom-lists'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPeopleRecords } from '@/lib/security/pii'

type PageProps = {
  params: Promise<{ id: string }>
}

type PersonSummaryRow = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  cell_phone: string | null
  home_phone: string | null
}

type CustomListMemberView = CustomListMemberRow & {
  person: PersonSummaryRow | null
  claimedBy: PersonSummaryRow | null
  lastContactBy: PersonSummaryRow | null
}

type SharedAccessView = CustomListShareGrantRow & {
  person: PersonSummaryRow | null
}

function fullName(person?: PersonSummaryRow | null) {
  if (!person) return 'Unknown member'
  return `${person.first_name} ${person.last_name}`.trim()
}

export default async function CustomListDetailPage({ params }: PageProps) {
  const { id } = await params
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const { data: listData, error: listError } = await admin
    .from('custom_lists')
    .select('id, council_id, local_unit_id, name, description, archived_at, created_at, updated_at, created_by_auth_user_id, updated_by_auth_user_id')
    .eq('id', id)
    .maybeSingle<CustomListRow>()

  if (listError) {
    throw new Error(`Could not load this custom list. ${listError.message}`)
  }

  if (!listData || listData.archived_at) {
    notFound()
  }

  const canView = await canViewCustomList({ admin, permissions, list: listData })
  if (!canView) {
    redirect('/me')
  }

  const [canManage, canManageLifecycle, listLocalUnitId] = await Promise.all([
    canManageCustomList(permissions, listData, admin),
    hasStrictCustomListLifecycleAccess({ admin, permissions, list: listData }),
    resolveCustomListLocalUnitId({ admin, list: listData }),
  ])

  if (canManage && !listLocalUnitId) {
    throw new Error('This custom list is missing its local organization link.')
  }

  const [membersResult, accessRows, eligiblePeople] = await Promise.all([
    admin
      .from('custom_list_members')
      .select('id, custom_list_id, person_id, claimed_by_person_id, claimed_at, last_contact_at, last_contact_by_person_id, added_at')
      .eq('custom_list_id', id)
      .order('added_at', { ascending: true })
      .returns<CustomListMemberRow[]>(),
    canManage
      ? listActiveCustomListShares({
          admin,
          customListId: id,
        })
      : Promise.resolve([] as CustomListShareGrantRow[]),
    canManage && listLocalUnitId
      ? listValidMemberPeopleForLocalUnit({
          admin,
          localUnitId: listLocalUnitId,
        })
      : Promise.resolve([] as PersonSummaryRow[]),
  ])

  if (membersResult.error) {
    throw new Error(`Could not load the members on this custom list. ${membersResult.error.message}`)
  }

  const memberRows = membersResult.data ?? []

  const peopleIds = [
    ...new Set([
      ...memberRows.map((row) => row.person_id),
      ...memberRows.map((row) => row.claimed_by_person_id).filter((value): value is string => Boolean(value)),
      ...memberRows.map((row) => row.last_contact_by_person_id).filter((value): value is string => Boolean(value)),
      ...accessRows.map((row) => row.person_id).filter((value): value is string => Boolean(value)),
    ]),
  ]

  const peoplePromise =
    peopleIds.length > 0
      ? admin
          .from('people')
          .select('id, first_name, last_name, email, cell_phone, home_phone')
          .in('id', peopleIds)
          .returns<PersonSummaryRow[]>()
      : Promise.resolve({ data: [] as PersonSummaryRow[], error: null })

  const shareablePeoplePromise =
    canManage && eligiblePeople.length > 0
      ? admin
          .from('users')
          .select('person_id')
          .in('person_id', eligiblePeople.map((person) => person.id))
      : Promise.resolve({ data: [] as Array<{ person_id: string | null }>, error: null })

  const [peopleResult, shareablePeopleResult] = await Promise.all([peoplePromise, shareablePeoplePromise])

  if (peopleResult.error) {
    throw new Error(`Could not load member details for this custom list. ${peopleResult.error.message}`)
  }

  if (shareablePeopleResult.error) {
    throw new Error(`Could not load shareable members for this custom list. ${shareablePeopleResult.error.message}`)
  }

  const peopleById = new Map<string, PersonSummaryRow>()
  for (const person of decryptPeopleRecords(peopleResult.data ?? [])) {
    peopleById.set(person.id, person)
  }

  const members: CustomListMemberView[] = memberRows.map((row) => ({
    ...row,
    person: peopleById.get(row.person_id) ?? null,
    claimedBy: row.claimed_by_person_id ? peopleById.get(row.claimed_by_person_id) ?? null : null,
    lastContactBy: row.last_contact_by_person_id ? peopleById.get(row.last_contact_by_person_id) ?? null : null,
  }))

  const sharedAccess: SharedAccessView[] = accessRows.map((row) => ({
    ...row,
    person: row.person_id ? peopleById.get(row.person_id) ?? null : null,
  }))

  const sharedPersonIds = new Set(sharedAccess.map((row) => row.person_id).filter((value): value is string => Boolean(value)))
  const listMemberIds = new Set(members.map((member) => member.person_id))
  const shareablePersonIds = new Set(
    ((shareablePeopleResult.data as Array<{ person_id: string | null }> | null) ?? [])
      .map((row) => row.person_id)
      .filter((value): value is string => Boolean(value))
  )

  const optionList = eligiblePeople.map((person) => ({
    id: person.id,
    name: fullName(person),
    email: person.email,
  }))

  const shareCandidates = optionList.filter((person) => shareablePersonIds.has(person.id) && !sharedPersonIds.has(person.id))
  const addCandidates = optionList.filter((person) => !listMemberIds.has(person.id))

  const claimedCount = members.filter((member) => Boolean(member.claimed_by_person_id)).length
  const contactedCount = members.filter((member) => Boolean(member.last_contact_at)).length

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section>
          <div className="qv-hero-card" style={{ paddingBottom: 16 }}>
            <div style={{ display: 'grid', gap: 18 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Link
                  href="/custom-lists"
                  aria-label="Back to custom lists"
                  className="qv-link-button"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    border: '1px solid var(--divider-strong)',
                    background: 'var(--bg-card)',
                    color: 'var(--interactive)',
                    fontSize: 18,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  ‹
                </Link>
                <p className="qv-eyebrow" style={{ margin: 0 }}>
                  Custom Lists
                </p>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <h1
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-heading), Georgia, serif',
                    fontSize: 'clamp(42px, 6vw, 58px)',
                    lineHeight: 0.98,
                    letterSpacing: '-0.035em',
                    color: 'var(--text-primary)',
                  }}
                >
                  {listData.name}
                </h1>

                <p className="qv-section-subtitle" style={{ margin: 0, maxWidth: '40ch' }}>
                  {listData.description || 'A shared member list for follow-up, care, prospects, or any other local-unit use.'}
                </p>

                <div className="qv-detail-badges" style={{ marginTop: 2 }}>
                  <span className="qv-badge">{members.length} member{members.length === 1 ? '' : 's'}</span>
                  <span className="qv-badge qv-badge-soft">{claimedCount} claimed</span>
                  <span className="qv-badge qv-badge-soft">{contactedCount} contacted</span>
                  {canManage ? <span className="qv-badge qv-badge-soft">Shared with {sharedAccess.length}</span> : null}
                </div>
              </div>
            </div>
          </div>

          {canManageLifecycle ? (
            <div className="qv-section-menu-shell" style={{ marginTop: -22 }}>
              <div
                style={{
                  minHeight: 58,
                  paddingInline: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <Link href={`/custom-lists/${listData.id}/edit`} className="qv-button-secondary qv-link-button">
                  Edit
                </Link>
                <ConfirmActionButton
                  action={archiveCustomListAction}
                  hiddenFields={[{ name: 'custom_list_id', value: listData.id }]}
                  triggerLabel="Archive this list"
                  confirmTitle="Archive this custom list?"
                  confirmDescription="This removes the list from the active custom-lists view but keeps its members and sharing intact so you can restore it or delete it permanently later from the archive."
                  confirmLabel="Archive this list"
                  triggerClassName="qv-button-secondary"
                  confirmClassName="qv-button-secondary"
                />
              </div>
            </div>
          ) : null}
        </section>

        <CustomListDetailClient
          listId={listData.id}
          listName={listData.name}
          canManage={canManage}
          currentPersonId={permissions.personId}
          members={members}
          sharedAccess={sharedAccess}
          shareCandidates={shareCandidates}
          addCandidates={addCandidates}
        />
      </div>
    </main>
  )
}
