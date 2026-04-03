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

type DirectoryData = {
  allPeople: DirectoryPerson[]
  members: DirectoryPerson[]
  prospects: DirectoryPerson[]
  volunteers: DirectoryPerson[]
  currentOfficerLabelsById: Record<string, string[]>
  executiveOfficerLabelsById: Record<string, string[]>
  officerCount: number
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
      .returns<DirectoryPerson[]>(),
    admin
      .from('person_officer_terms')
      .select('id, person_id, office_scope_code, office_code, office_label, office_rank, service_start_year, service_end_year, notes')
      .eq('council_id', councilId)
      .returns<OfficerTermWithPerson[]>(),
  ])

  if (peopleError) {
    throw new Error(`Could not load members. ${peopleError.message}`)
  }

  if (officerTermsError) {
    throw new Error(`Could not load officer terms. ${officerTermsError.message}`)
  }

  const allPeople = decryptPeopleRecords<DirectoryPerson>(peopleData ?? [])
  const members = allPeople.filter((person: DirectoryPerson) => person.primary_relationship_code === 'member')
  const prospects = allPeople.filter((person: DirectoryPerson) => person.primary_relationship_code === 'prospect')
  const volunteers = allPeople.filter((person: DirectoryPerson) => person.primary_relationship_code === 'volunteer_only')

  const officerTerms: OfficerTermWithPerson[] = officerTermsData ?? []
  const uniquePersonIds = [...new Set(officerTerms.map((term: OfficerTermWithPerson) => term.person_id))]

  const currentOfficerLabelsById: Record<string, string[]> = Object.fromEntries(
    uniquePersonIds.map((personId) => [
      personId,
      summarizeCurrentOfficerLabels(officerTerms.filter((term: OfficerTermWithPerson) => term.person_id === personId)),
    ] as const)
  )

  const executiveOfficerLabelsById: Record<string, string[]> = Object.fromEntries(
    uniquePersonIds.map((personId) => [
      personId,
      summarizeExecutiveOfficerLabels(officerTerms.filter((term: OfficerTermWithPerson) => term.person_id === personId)),
    ] as const)
  )

  const officerCount = Object.values(currentOfficerLabelsById).filter((labels: string[]) => labels.length > 0).length

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
