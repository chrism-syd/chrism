import { createAdminClient } from '@/lib/supabase/admin'
import {
  summarizeCurrentOfficerLabels,
  summarizeExecutiveOfficerLabels,
  type OfficerTermRow,
} from '@/lib/members/officer-roles'
import { decryptPeopleRecords } from '@/lib/security/pii'

export type DirectoryPerson = {
  id: string
  first_name: string
  last_name: string
  preferred_display_name: string | null
  email: string | null
  cell_phone: string | null
  home_phone: string | null
  other_phone: string | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state_province: string | null
  postal_code: string | null
  primary_relationship_code: string
  council_activity_level_code: string | null
  council_activity_context_code: string | null
  council_reengagement_status_code: string | null
}

type OfficerTermWithPerson = OfficerTermRow & { person_id: string }

type DirectoryLocalUnitRow = {
  id: string
  legacy_council_id: string | null
}

type DirectoryData = {
  allPeople: DirectoryPerson[]
  members: DirectoryPerson[]
  prospects: DirectoryPerson[]
  volunteers: DirectoryPerson[]
  currentOfficerLabelsById: Record<string, string[]>
  executiveOfficerLabelsById: Record<string, string[]>
  officerCount: number
}

function buildDirectoryData(args: {
  people: DirectoryPerson[]
  officerTerms: OfficerTermWithPerson[]
}): DirectoryData {
  const allPeople = args.people
  const members = allPeople.filter((person) => person.primary_relationship_code === 'member')
  const prospects = allPeople.filter((person) => person.primary_relationship_code === 'prospect')
  const volunteers = allPeople.filter((person) => person.primary_relationship_code === 'volunteer_only')

  const scopedPersonIds = new Set(allPeople.map((person) => person.id))
  const officerTerms = args.officerTerms.filter((term) => scopedPersonIds.has(term.person_id))
  const uniquePersonIds = [...new Set(officerTerms.map((term) => term.person_id))]

  const currentOfficerLabelsById: Record<string, string[]> = Object.fromEntries(
    uniquePersonIds.map((personId) => [
      personId,
      summarizeCurrentOfficerLabels(officerTerms.filter((term) => term.person_id === personId)),
    ] as const)
  )

  const executiveOfficerLabelsById: Record<string, string[]> = Object.fromEntries(
    uniquePersonIds.map((personId) => [
      personId,
      summarizeExecutiveOfficerLabels(officerTerms.filter((term) => term.person_id === personId)),
    ] as const)
  )

  const officerCount = Object.values(currentOfficerLabelsById).filter((labels) => labels.length > 0).length

  return {
    allPeople,
    members,
    prospects,
    volunteers,
    currentOfficerLabelsById,
    executiveOfficerLabelsById,
    officerCount,
  }
}

export async function loadCouncilMemberDirectoryData(args: {
  admin: ReturnType<typeof createAdminClient>
  councilId: string
}): Promise<DirectoryData> {
  const { admin, councilId } = args

  const [{ data: peopleData, error: peopleError }, { data: officerTermsData, error: officerTermsError }] = await Promise.all([
    admin
      .from('people')
      .select(
        'id, first_name, last_name, email, cell_phone, home_phone, other_phone, address_line_1, address_line_2, city, state_province, postal_code, primary_relationship_code, council_activity_level_code, council_activity_context_code, council_reengagement_status_code'
      )
      .eq('council_id', councilId)
      .is('archived_at', null)
      .is('merged_into_person_id', null)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })
      .returns<Array<Omit<DirectoryPerson, 'preferred_display_name'>>>(),
    admin
      .from('person_officer_terms')
      .select('id, person_id, office_scope_code, office_code, office_label, office_rank, service_start_year, service_end_year, notes')
      .eq('council_id', councilId)
      .returns<OfficerTermWithPerson[]>(),
  ])

  if (peopleError) throw new Error(`Could not load members. ${peopleError.message}`)
  if (officerTermsError) throw new Error(`Could not load officer terms. ${officerTermsError.message}`)

  return buildDirectoryData({
    people: decryptPeopleRecords<Omit<DirectoryPerson, 'preferred_display_name'>>(peopleData ?? []).map((person) => ({
      ...person,
      preferred_display_name: null,
    })),
    officerTerms: officerTermsData ?? [],
  })
}

export async function loadLocalUnitMemberDirectoryData(args: {
  admin: ReturnType<typeof createAdminClient>
  localUnitId: string
}): Promise<DirectoryData> {
  const { admin, localUnitId } = args

  const [{ data: membershipData, error: membershipError }, { data: localUnitData, error: localUnitError }] = await Promise.all([
    admin
      .from('member_records')
      .select('legacy_people_id, preferred_display_name')
      .eq('local_unit_id', localUnitId)
      .is('archived_at', null),
    admin
      .from('local_units')
      .select('id, legacy_council_id')
      .eq('id', localUnitId)
      .maybeSingle<DirectoryLocalUnitRow>(),
  ])

  if (membershipError) throw new Error(`Could not load local-unit member records. ${membershipError.message}`)
  if (localUnitError) throw new Error(`Could not load local-unit context. ${localUnitError.message}`)

  const membershipRows = ((membershipData as Array<{ legacy_people_id: string | null; preferred_display_name: string | null }> | null) ?? [])
  const personIds = [...new Set(membershipRows.map((row) => row.legacy_people_id).filter((value): value is string => Boolean(value)))]

  if (personIds.length === 0) {
    return buildDirectoryData({ people: [], officerTerms: [] })
  }

  const preferredNameByPersonId = new Map<string, string | null>()
  for (const row of membershipRows) {
    if (row.legacy_people_id && !preferredNameByPersonId.has(row.legacy_people_id)) {
      preferredNameByPersonId.set(row.legacy_people_id, row.preferred_display_name ?? null)
    }
  }

  const localUnit = (localUnitData as DirectoryLocalUnitRow | null) ?? null

  const [{ data: peopleData, error: peopleError }, { data: officerTermsData, error: officerTermsError }] = await Promise.all([
    admin
      .from('people')
      .select(
        'id, first_name, last_name, email, cell_phone, home_phone, other_phone, address_line_1, address_line_2, city, state_province, postal_code, primary_relationship_code, council_activity_level_code, council_activity_context_code, council_reengagement_status_code'
      )
      .in('id', personIds)
      .is('archived_at', null)
      .is('merged_into_person_id', null)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })
      .returns<Array<Omit<DirectoryPerson, 'preferred_display_name'>>>(),
    localUnit?.legacy_council_id
      ? admin
          .from('person_officer_terms')
          .select('id, person_id, office_scope_code, office_code, office_label, office_rank, service_start_year, service_end_year, notes')
          .eq('council_id', localUnit.legacy_council_id)
          .returns<OfficerTermWithPerson[]>()
      : Promise.resolve({ data: [] as OfficerTermWithPerson[], error: null }),
  ])

  if (peopleError) throw new Error(`Could not load local-unit members. ${peopleError.message}`)
  if (officerTermsError) throw new Error(`Could not load officer terms for this local unit. ${officerTermsError.message}`)

  return buildDirectoryData({
    people: decryptPeopleRecords<Omit<DirectoryPerson, 'preferred_display_name'>>(peopleData ?? []).map((person) => ({
      ...person,
      preferred_display_name: preferredNameByPersonId.get(person.id) ?? null,
    })),
    officerTerms: officerTermsData ?? [],
  })
}
