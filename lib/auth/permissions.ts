import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import { isAutomaticCouncilAdminTerm } from '@/lib/members/officer-roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  ACTING_COUNCIL_COOKIE,
  ACTING_MODE_COOKIE,
  ACTING_ORGANIZATION_COOKIE,
  getSuperAdminViewLabel,
  isConfiguredSuperAdminEmail,
  normalizeActingMode,
  type ActingMode,
} from '@/lib/auth/super-admin'

export type CurrentUserPermissions = {
  authUser: User | null
  appUser: {
    id: string
    person_id: string | null
    is_active?: boolean | null
    is_super_admin?: boolean | null
  } | null
  isSignedIn: boolean
  hasStaffAccess: boolean
  isCouncilAdmin: boolean
  isSuperAdmin: boolean
  actingMode: ActingMode
  isDevMode: boolean
  currentViewLabel: string | null
  organizationId: string | null
  organizationName: string | null
  councilId: string | null
  personId: string | null
  email: string | null
}

type AppUserRow = NonNullable<CurrentUserPermissions['appUser']>
type CouncilAdminAssignmentRow = { council_id: string | null }
type OrganizationAdminAssignmentRow = { organization_id: string | null }
type AutomaticCouncilAdminTermRow = {
  council_id: string | null
  office_scope_code: string
  office_code: string
}

type LinkedPersonCouncilRow = {
  council_id: string | null
}

type CouncilContextRow = {
  organization_id: string | null
  organizations:
    | { display_name: string | null; preferred_name: string | null }
    | Array<{ display_name: string | null; preferred_name: string | null }>
    | null
}

type OfficerRoleEmailRow = {
  council_id: string
  office_scope_code: string
  office_code: string
  office_rank: number | null
}

type OfficerEmailTermRow = {
  person_id: string
  council_id: string | null
  office_scope_code: string
  office_code: string
  office_rank: number | null
  service_end_year: number | null
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null
}

export async function getCurrentUserPermissions(): Promise<CurrentUserPermissions> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      authUser: null,
      appUser: null,
      isSignedIn: false,
      hasStaffAccess: false,
      isCouncilAdmin: false,
      isSuperAdmin: false,
      actingMode: 'normal',
      isDevMode: false,
      currentViewLabel: null,
      organizationId: null,
      organizationName: null,
      councilId: null,
      personId: null,
      email: null,
    }
  }

  const admin = createAdminClient()
  const normalizedEmail = normalizeEmail(user.email)

  const { data: appUserData } = await admin
    .from('users')
    .select('id, person_id, is_active, is_super_admin')
    .eq('id', user.id)
    .maybeSingle()

  const appUser = (appUserData as AppUserRow | null) ?? null
  const explicitSuperAdmin = Boolean(appUser?.is_super_admin)
  const isSuperAdmin = explicitSuperAdmin || isConfiguredSuperAdminEmail(normalizedEmail)
  const currentYear = new Date().getFullYear()

  let derivedOfficerEmailPersonId: string | null = null
  let derivedOfficerEmailCouncilId: string | null = null

  if (normalizedEmail) {
    const { data: officerRoleEmailData } = await admin
      .from('officer_role_emails')
      .select('council_id, office_scope_code, office_code, office_rank')
      .eq('is_active', true)
      .eq('login_enabled', true)
      .ilike('email', normalizedEmail)
      .limit(5)

    const officerRoleEmails = (officerRoleEmailData as OfficerRoleEmailRow[] | null) ?? []

    if (officerRoleEmails.length > 0) {
      const councilIds = [...new Set(officerRoleEmails.map((row) => row.council_id))]
      const { data: officerTermData } = await admin
        .from('person_officer_terms')
        .select('person_id, council_id, office_scope_code, office_code, office_rank, service_end_year')
        .in('council_id', councilIds)
        .or(`service_end_year.is.null,service_end_year.gte.${currentYear}`)
        .limit(50)

      const officerTerms = (officerTermData as OfficerEmailTermRow[] | null) ?? []
      const matchingTerm = officerTerms.find((term) =>
        officerRoleEmails.some(
          (emailRow) =>
            emailRow.council_id === term.council_id &&
            emailRow.office_scope_code === term.office_scope_code &&
            emailRow.office_code === term.office_code &&
            (emailRow.office_rank ?? null) === (term.office_rank ?? null)
        )
      )

      derivedOfficerEmailPersonId = matchingTerm?.person_id ?? null
      derivedOfficerEmailCouncilId = matchingTerm?.council_id ?? null
    }
  }

  const personId = appUser?.person_id ?? derivedOfficerEmailPersonId ?? null
  const realHasStaffAccess = (Boolean(appUser?.id) && appUser?.is_active !== false) || Boolean(derivedOfficerEmailPersonId)

  const [councilAdminAssignmentResult, organizationAdminAssignmentResult, automaticCouncilAdminTermResult] = await Promise.all([
    admin
      .from('council_admin_assignments')
      .select('council_id')
      .eq('is_active', true)
      .or(
        [
          `user_id.eq.${user.id}`,
          personId ? `person_id.eq.${personId}` : '',
          normalizedEmail ? `grantee_email.eq.${normalizedEmail}` : '',
        ]
          .filter(Boolean)
          .join(',')
      )
      .limit(10),
    admin
      .from('organization_admin_assignments')
      .select('organization_id')
      .eq('is_active', true)
      .or(
        [
          `user_id.eq.${user.id}`,
          personId ? `person_id.eq.${personId}` : '',
          normalizedEmail ? `grantee_email.eq.${normalizedEmail}` : '',
        ]
          .filter(Boolean)
          .join(',')
      )
      .limit(10),
    personId
      ? admin
          .from('person_officer_terms')
          .select('council_id, office_scope_code, office_code')
          .eq('person_id', personId)
          .or(`service_end_year.is.null,service_end_year.gte.${currentYear}`)
          .limit(20)
      : Promise.resolve({ data: [] as AutomaticCouncilAdminTermRow[] }),
  ])

  const councilAdminAssignments =
    (councilAdminAssignmentResult.data as CouncilAdminAssignmentRow[] | null)?.filter(
      (row): row is CouncilAdminAssignmentRow & { council_id: string } => Boolean(row.council_id)
    ) ?? []

  const organizationAdminAssignments =
    (organizationAdminAssignmentResult.data as OrganizationAdminAssignmentRow[] | null)?.filter(
      (row): row is OrganizationAdminAssignmentRow & { organization_id: string } => Boolean(row.organization_id)
    ) ?? []

  const automaticCouncilAdminTerms =
    (automaticCouncilAdminTermResult.data as AutomaticCouncilAdminTermRow[] | null)?.filter(
      (term): term is AutomaticCouncilAdminTermRow & { council_id: string } =>
        Boolean(term.council_id) && isAutomaticCouncilAdminTerm(term)
    ) ?? []

  let realCouncilId: string | null =
    councilAdminAssignments[0]?.council_id ??
    automaticCouncilAdminTerms[0]?.council_id ??
    derivedOfficerEmailCouncilId ??
    null

  let realOrganizationId = organizationAdminAssignments[0]?.organization_id ?? null
  let realOrganizationName: string | null = null

  if (!realCouncilId && personId) {
    const { data: linkedPersonData } = await admin
      .from('people')
      .select('council_id')
      .eq('id', personId)
      .maybeSingle()

    realCouncilId = ((linkedPersonData as LinkedPersonCouncilRow | null)?.council_id ?? null) || realCouncilId
  }

  if (!realCouncilId && realOrganizationId) {
    const { data: linkedCouncilData } = await admin
      .from('councils')
      .select('id')
      .eq('organization_id', realOrganizationId)
      .maybeSingle()

    realCouncilId = (linkedCouncilData as { id: string } | null)?.id ?? null
  }

  if (realCouncilId) {
    const { data: councilData } = await admin
      .from('councils')
      .select('organization_id, organizations(display_name, preferred_name)')
      .eq('id', realCouncilId)
      .maybeSingle()

    const councilRow = (councilData as CouncilContextRow | null) ?? null
    const organization = Array.isArray(councilRow?.organizations)
      ? councilRow.organizations[0]
      : councilRow?.organizations

    realOrganizationId = councilRow?.organization_id ?? realOrganizationId
    realOrganizationName = organization?.preferred_name ?? organization?.display_name ?? realOrganizationName
  }

  if (!realOrganizationName && realOrganizationId) {
    const { data: organizationData } = await admin
      .from('organizations')
      .select('display_name, preferred_name')
      .eq('id', realOrganizationId)
      .maybeSingle()

    const organizationRow = organizationData as { display_name: string | null; preferred_name: string | null } | null
    realOrganizationName = organizationRow?.preferred_name ?? organizationRow?.display_name ?? null
  }

  const realIsCouncilAdmin =
    explicitSuperAdmin ||
    councilAdminAssignments.some((assignment) => assignment.council_id === realCouncilId) ||
    automaticCouncilAdminTerms.some((term) => term.council_id === realCouncilId) ||
    organizationAdminAssignments.some((assignment) => assignment.organization_id === realOrganizationId)

  const cookieStore = await cookies()
  const actingMode = isSuperAdmin ? normalizeActingMode(cookieStore.get(ACTING_MODE_COOKIE)?.value) : 'normal'
  const requestedOrganizationId = isSuperAdmin ? cookieStore.get(ACTING_ORGANIZATION_COOKIE)?.value ?? null : null
  const requestedCouncilId = isSuperAdmin ? cookieStore.get(ACTING_COUNCIL_COOKIE)?.value ?? null : null

  let organizationId: string | null = realOrganizationId
  let organizationName: string | null = realOrganizationName
  let councilId: string | null = realCouncilId
  let hasStaffAccess =
    realHasStaffAccess ||
    councilAdminAssignments.length > 0 ||
    organizationAdminAssignments.length > 0 ||
    automaticCouncilAdminTerms.length > 0
  let isCouncilAdmin = realIsCouncilAdmin

  if (isSuperAdmin && actingMode !== 'normal') {
    organizationId = requestedOrganizationId ?? realOrganizationId
    councilId = requestedCouncilId ?? null

    if (organizationId) {
      const { data: orgData } = await admin
        .from('organizations')
        .select('display_name, preferred_name')
        .eq('id', organizationId)
        .maybeSingle()
      const orgRow = orgData as { display_name: string | null; preferred_name: string | null } | null
      organizationName = orgRow?.preferred_name ?? orgRow?.display_name ?? organizationName
    }

    if (!councilId && organizationId) {
      const { data: linkedCouncil } = await admin
        .from('councils')
        .select('id')
        .eq('organization_id', organizationId)
        .maybeSingle()
      councilId = (linkedCouncil as { id: string } | null)?.id ?? null
    }

    hasStaffAccess = actingMode === 'admin' && Boolean(councilId)
    isCouncilAdmin = actingMode === 'admin' && Boolean(councilId)
  }

  return {
    authUser: user,
    appUser,
    isSignedIn: true,
    hasStaffAccess,
    isCouncilAdmin,
    isSuperAdmin,
    actingMode,
    isDevMode: actingMode === 'admin',
    currentViewLabel: isSuperAdmin
      ? getSuperAdminViewLabel({ mode: actingMode, organizationName })
      : null,
    organizationId,
    organizationName,
    councilId,
    personId,
    email: normalizedEmail,
  }
}
