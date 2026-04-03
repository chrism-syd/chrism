import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  buildAvailableAccessContexts,
  getCurrentAreaContextCookieValues,
  getDefaultAccessContext,
  getStoredAccessContextKey,
  type CurrentUserAccessContext,
} from '@/lib/auth/access-contexts'
import { getParallelAccessSummary } from '@/lib/auth/parallel-access-summary'
import { isParallelAccessEnabled } from '@/lib/auth/feature-flags'
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
  isOrganizationMember: boolean
  hasStaffAccess: boolean
  isCouncilAdmin: boolean
  canAccessMemberData: boolean
  canManageEvents: boolean
  canAccessOfficerDirectory: boolean
  canManageCustomLists: boolean
  canReviewMemberChanges: boolean
  canImportMembers: boolean
  canAccessOrganizationSettings: boolean
  canManageAdmins: boolean
  canReviewClaims: boolean
  isSuperAdmin: boolean
  actingMode: ActingMode
  isDevMode: boolean
  currentViewLabel: string | null
  organizationId: string | null
  organizationName: string | null
  councilId: string | null
  personId: string | null
  email: string | null
  availableContexts: CurrentUserAccessContext[]
  activeContextKey: string | null
}

type AppUserRow = NonNullable<CurrentUserPermissions['appUser']> & {
  council_id?: string | null
}

type PersonRow = {
  id: string
  council_id: string | null
}

type OrganizationRow = {
  id: string
  display_name: string | null
  preferred_name: string | null
}

type CouncilRow = {
  id: string
  name: string | null
  council_number: string | null
  organization_id: string | null
}

type ParallelAccessRow = {
  organization_id: string | null
  local_unit_id: string | null
  local_unit_name: string | null
  can_manage_members: boolean | null
  can_manage_events: boolean | null
  can_manage_custom_lists: boolean | null
  can_manage_claims: boolean | null
  can_manage_admins: boolean | null
  can_manage_local_unit_settings: boolean | null
}

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null
}

async function ensureAppUserRow(args: {
  admin: ReturnType<typeof createAdminClient>
  authUserId: string
  existingAppUser: AppUserRow | null
  personId?: string | null
  councilId?: string | null
  isSuperAdmin?: boolean
}) {
  const {
    admin,
    authUserId,
    existingAppUser,
    personId = null,
    councilId = null,
    isSuperAdmin = false,
  } = args

  const needsInsert = !existingAppUser
  const needsSync =
    !needsInsert &&
    ((personId && existingAppUser.person_id !== personId) ||
      (councilId && (existingAppUser.council_id ?? null) !== councilId) ||
      (isSuperAdmin && !existingAppUser.is_super_admin) ||
      existingAppUser.is_active === false)

  if (!needsInsert && !needsSync) {
    return existingAppUser
  }

  const payload = {
    id: authUserId,
    person_id: personId ?? existingAppUser?.person_id ?? null,
    council_id: councilId ?? existingAppUser?.council_id ?? null,
    is_active: existingAppUser?.is_active ?? true,
    is_super_admin: isSuperAdmin || existingAppUser?.is_super_admin || false,
  }

  const { data, error } = await admin
    .from('users')
    .upsert(payload, { onConflict: 'id' })
    .select('id, person_id, council_id, is_active, is_super_admin')
    .maybeSingle()

  if (error) {
    throw new Error(`Could not provision app user row: ${error.message}`)
  }

  return (data as AppUserRow | null) ?? {
    id: authUserId,
    person_id: payload.person_id,
    council_id: payload.council_id,
    is_active: payload.is_active,
    is_super_admin: payload.is_super_admin,
  }
}

async function getParallelAccessRows(args: {
  admin: ReturnType<typeof createAdminClient>
  authUserId: string
}) {
  const { admin, authUserId } = args

  const { data } = await admin
    .from('v_effective_admin_package_access')
    .select(
      'organization_id, local_unit_id, local_unit_name, can_manage_members, can_manage_events, can_manage_custom_lists, can_manage_claims, can_manage_admins, can_manage_local_unit_settings'
    )
    .eq('user_id', authUserId)

  return (data as ParallelAccessRow[] | null) ?? []
}

async function lookupOrganization(args: {
  admin: ReturnType<typeof createAdminClient>
  organizationId: string | null
}) {
  const { admin, organizationId } = args
  if (!organizationId) return null

  const { data } = await admin
    .from('organizations')
    .select('id, display_name, preferred_name')
    .eq('id', organizationId)
    .maybeSingle<OrganizationRow>()

  return data ?? null
}

async function lookupCouncil(args: {
  admin: ReturnType<typeof createAdminClient>
  councilId: string | null
}) {
  const { admin, councilId } = args
  if (!councilId) return null

  const { data } = await admin
    .from('councils')
    .select('id, name, council_number, organization_id')
    .eq('id', councilId)
    .maybeSingle<CouncilRow>()

  return data ?? null
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
      isOrganizationMember: false,
      hasStaffAccess: false,
      isCouncilAdmin: false,
      canAccessMemberData: false,
      canManageEvents: false,
      canAccessOfficerDirectory: false,
      canManageCustomLists: false,
      canReviewMemberChanges: false,
      canImportMembers: false,
      canAccessOrganizationSettings: false,
      canManageAdmins: false,
      canReviewClaims: false,
      isSuperAdmin: false,
      actingMode: 'normal',
      isDevMode: false,
      currentViewLabel: null,
      organizationId: null,
      organizationName: null,
      councilId: null,
      personId: null,
      email: null,
      availableContexts: [],
      activeContextKey: null,
    }
  }

  const admin = createAdminClient()
  const normalizedEmail = normalizeEmail(user.email)

  const { data: appUserData } = await admin
    .from('users')
    .select('id, person_id, council_id, is_active, is_super_admin')
    .eq('id', user.id)
    .maybeSingle()

  let appUser = (appUserData as AppUserRow | null) ?? null
  const explicitSuperAdmin = Boolean(appUser?.is_super_admin)
  const isSuperAdmin = explicitSuperAdmin || isConfiguredSuperAdminEmail(normalizedEmail)

  let personId = appUser?.person_id ?? null
  if (!personId) {
    const { data: personData } = await admin
      .from('people')
      .select('id, council_id')
      .ilike('email_hash', '')
      .limit(0)
    void personData
  }

  if (!personId && normalizedEmail) {
    const { data: personMatch } = await admin
      .from('people')
      .select('id, council_id')
      .eq('email_hash', null as unknown as string)
      .limit(0)
    void personMatch
  }

  if (!personId) {
    const { data: personRow } = await admin
      .from('people')
      .select('id, council_id')
      .eq('id', appUser?.person_id ?? '')
      .maybeSingle<PersonRow>()
    if (personRow?.id) {
      personId = personRow.id
    }
  }

  let fallbackCouncilId = appUser?.council_id ?? null
  if (!fallbackCouncilId && personId) {
    const { data: personRow } = await admin
      .from('people')
      .select('id, council_id')
      .eq('id', personId)
      .maybeSingle<PersonRow>()
    fallbackCouncilId = personRow?.council_id ?? null
  }

  const parallelEnabled = isParallelAccessEnabled()
  const parallelRows = parallelEnabled
    ? await getParallelAccessRows({ admin, authUserId: user.id })
    : []
  const parallelSummary = getParallelAccessSummary({ rows: parallelRows })

  let organizationId = parallelSummary.organizationId ?? null
  let councilId = fallbackCouncilId
  let organizationName: string | null = null

  if (parallelSummary.organizationId) {
    const organization = await lookupOrganization({
      admin,
      organizationId: parallelSummary.organizationId,
    })
    organizationName = organization?.preferred_name ?? organization?.display_name ?? null
  }

  if (!organizationName && councilId) {
    const council = await lookupCouncil({ admin, councilId })
    if (council?.organization_id) {
      organizationId = council.organization_id
      const organization = await lookupOrganization({
        admin,
        organizationId: council.organization_id,
      })
      organizationName = organization?.preferred_name ?? organization?.display_name ?? null
    }
  }

  appUser = await ensureAppUserRow({
    admin,
    authUserId: user.id,
    existingAppUser: appUser,
    personId,
    councilId,
    isSuperAdmin,
  })

  const availableContexts = buildAvailableAccessContexts({
    permissions: {
      authUser: user,
      appUser,
      isSignedIn: true,
      isOrganizationMember: parallelSummary.isOrganizationMember || Boolean(personId),
      hasStaffAccess: parallelSummary.hasStaffAccess,
      isCouncilAdmin: parallelSummary.canManageAdmins,
      canAccessMemberData: parallelSummary.canAccessMemberData,
      canManageEvents: parallelSummary.canManageEvents,
      canAccessOfficerDirectory: parallelSummary.canAccessMemberData,
      canManageCustomLists: parallelSummary.canManageCustomLists,
      canReviewMemberChanges: parallelSummary.canAccessMemberData,
      canImportMembers: parallelSummary.canAccessMemberData,
      canAccessOrganizationSettings: parallelSummary.canAccessOrganizationSettings,
      canManageAdmins: parallelSummary.canManageAdmins,
      canReviewClaims: parallelSummary.canReviewClaims,
      isSuperAdmin,
      actingMode: 'normal',
      isDevMode: false,
      currentViewLabel: null,
      organizationId,
      organizationName,
      councilId,
      personId,
      email: normalizedEmail,
      availableContexts: [],
      activeContextKey: null,
    },
    rows: parallelRows,
  })

  const storedAccessContextKey = await getStoredAccessContextKey()
  const defaultAccessContext = getDefaultAccessContext({
    contexts: availableContexts,
    preferredKey: storedAccessContextKey,
  })

  let activeContextKey = defaultAccessContext?.key ?? null
  let effectiveHasStaffAccess = parallelSummary.hasStaffAccess
  let effectiveOrganizationId = defaultAccessContext?.organizationId ?? organizationId
  let effectiveOrganizationName = defaultAccessContext?.organizationName ?? organizationName
  let effectiveCouncilId = defaultAccessContext?.councilId ?? councilId

  if (defaultAccessContext && defaultAccessContext.accessLevel === 'member') {
    const firstStaffContext = availableContexts.find((context) => context.accessLevel !== 'member')
    if (firstStaffContext && !isSuperAdmin) {
      activeContextKey = firstStaffContext.key
      effectiveOrganizationId = firstStaffContext.organizationId
      effectiveOrganizationName = firstStaffContext.organizationName
      effectiveCouncilId = firstStaffContext.councilId
    }
  }

  const cookieStore = await cookies()
  const actingMode = isSuperAdmin
    ? normalizeActingMode(cookieStore.get(ACTING_MODE_COOKIE)?.value)
    : 'normal'
  const requestedOrganizationId = isSuperAdmin
    ? cookieStore.get(ACTING_ORGANIZATION_COOKIE)?.value ?? null
    : null
  const requestedCouncilId = isSuperAdmin
    ? cookieStore.get(ACTING_COUNCIL_COOKIE)?.value ?? null
    : null

  if (isSuperAdmin && actingMode !== 'normal') {
    effectiveOrganizationId = requestedOrganizationId ?? effectiveOrganizationId
    effectiveCouncilId = requestedCouncilId ?? effectiveCouncilId
    if (effectiveOrganizationId) {
      const actingOrganization = await lookupOrganization({
        admin,
        organizationId: effectiveOrganizationId,
      })
      effectiveOrganizationName =
        actingOrganization?.preferred_name ?? actingOrganization?.display_name ?? effectiveOrganizationName
    }
    effectiveHasStaffAccess = actingMode === 'admin' ? true : false
  }

  const currentViewLabel = isSuperAdmin
    ? getSuperAdminViewLabel({ mode: actingMode, organizationName: effectiveOrganizationName })
    : null

  return {
    authUser: user,
    appUser: appUser
      ? {
          id: appUser.id,
          person_id: appUser.person_id,
          is_active: appUser.is_active,
          is_super_admin: appUser.is_super_admin,
        }
      : null,
    isSignedIn: true,
    isOrganizationMember: parallelSummary.isOrganizationMember || Boolean(personId),
    hasStaffAccess: effectiveHasStaffAccess,
    isCouncilAdmin: parallelSummary.canManageAdmins,
    canAccessMemberData: parallelSummary.canAccessMemberData,
    canManageEvents: parallelSummary.canManageEvents,
    canAccessOfficerDirectory: parallelSummary.canAccessMemberData,
    canManageCustomLists: parallelSummary.canManageCustomLists,
    canReviewMemberChanges: parallelSummary.canAccessMemberData,
    canImportMembers: parallelSummary.canAccessMemberData,
    canAccessOrganizationSettings: parallelSummary.canAccessOrganizationSettings,
    canManageAdmins: parallelSummary.canManageAdmins,
    canReviewClaims: parallelSummary.canReviewClaims,
    isSuperAdmin,
    actingMode,
    isDevMode: actingMode !== 'normal',
    currentViewLabel,
    organizationId: effectiveOrganizationId,
    organizationName: effectiveOrganizationName,
    councilId: effectiveCouncilId,
    personId,
    email: normalizedEmail,
    availableContexts,
    activeContextKey,
  }
}
