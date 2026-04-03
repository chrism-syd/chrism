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
  type CustomListAccessRow,
  type CustomListMemberRow,
  type CustomListRow,
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

type SharedAccessView = CustomListAccessRow & {
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

  const [canManage, canManageLifecycle] = await Promise.all([
    canManageCustomList(permissions, listData, admin),
    hasStrictCustomListLifecycleAccess({ admin, permissions, list: listData }),
  ])

  const [membersResult, accessResult, eligiblePeopleResult] = await Promise.all([
    admin
      .from('custom_list_members')
      .select('id, custom_list_id, person_id, claimed_by_person_id, claimed_at, last_contact_at, last_contact_by_person_id, added_at')
      .eq('custom_list_id', id)
      .order('added_at', { ascending: true })
      .returns<CustomListMemberRow[]>(),
    canManage
      ? admin
          .from('custom_list_access')
          .select('id, custom_list_id, person_id, user_id, grantee_email, granted_at, granted_by_auth_user_id')
          .eq('custom_list_id', id)
          .order('granted_at', { ascending: true })
          .returns<CustomListAccessRow[]>()
      : Promise.resolve({ data: [] as CustomListAccessRow[], error: null }),
    canManage
      ? admin
          .from('people')
          .select('id, first_name, last_name, email, cell_phone, home_phone')
          .eq('council_id', listData.council_id)
          .eq('primary_relationship_code', 'member')
          .is('archived_at', null)
          .order('last_name', { ascending: true })
          .returns<PersonSummaryRow[]>()
      : Promise.resolve({ data: [] as PersonSummaryRow[], error: null }),
  ])

  if (membersResult.error) {
    throw new Error(`Could not load the members on this custom list. ${membersResult.error.message}`)
  }
  if (eligiblePeopleResult.error) {
    throw new Error(`Could not load the eligible members for this custom list. ${eligiblePeopleResult.error.message}`)
  }

  const memberRows = membersResult.data ?? []
  const accessRows = accessResult.data ?? []
  const eligiblePeople = decryptPeopleRecords(eligiblePeopleResult.data ?? [])

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

  const peopleResult = await peoplePromise
  if (peopleResult.error) {
    throw new Error(`Could not load member details for this custom list. ${peopleResult.error.message}`)
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

  const optionList = eligiblePeople.map((person) => ({
    id: person.id,
    name: fullName(person),
    email: person.email,
  }))

  const shareCandidates = optionList.filter((person) => !sharedPersonIds.has(person.id))
  const addCandidates = optionList.filter((person) => !listMemberIds.has(person.id))

  const claimedCount = members.filter((member) => Boolean(member.claimed_by_person_id)).length
  const contactedCount = members.filter((member) => Boolean(member.last_contact_at)).length

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-detail-hero-main">
            <div>
              <p className="qv-eyebrow">Custom lists</p>
              <h1 className="qv-title">{listData.name}</h1>
              <p className="qv-subtitle">{listData.description || 'A shared member list for follow-up, care, prospects, or any other council use.'}</p>
              <div className="qv-detail-badges">
                <span className="qv-badge">{members.length} member{members.length === 1 ? '' : 's'}</span>
                <span className="qv-badge qv-badge-soft">{claimedCount} claimed</span>
                <span className="qv-badge qv-badge-soft">{contactedCount} contacted</span>
                {canManage ? <span className="qv-badge qv-badge-soft">Shared with {sharedAccess.length}</span> : null}
              </div>
            </div>
          </div>

          <div className="qv-detail-actions" style={{ marginTop: 20 }}>
            <Link href="/custom-lists" className="qv-button-secondary qv-link-button">
              Back to custom lists
            </Link>
            {canManage ? (
              <Link href="/custom-lists?showMemberDirectory=1#member-directory-section" className="qv-button-secondary qv-link-button">
                Member directory
              </Link>
            ) : null}
            {canManageLifecycle ? (
              <ConfirmActionButton
                action={archiveCustomListAction}
                hiddenFields={[{ name: 'custom_list_id', value: listData.id }]}
                triggerLabel="Archive list"
                confirmTitle="Archive this custom list?"
                confirmDescription="This removes the list from the active custom-lists view but keeps its members and sharing intact so you can restore it or delete it permanently later from the archive."
                confirmLabel="Archive list"
                danger
              />
            ) : null}
          </div>
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
