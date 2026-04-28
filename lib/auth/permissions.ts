import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import {
  buildAccessContextKey,
  buildAccessContexts,
  pickDefaultAccessContext,
  type AccessContextOption,
  type AccessContextSource,
} from '@/lib/auth/access-contexts'
import { listAccessibleLocalUnitsForArea } from '@/lib/auth/area-access'
import { getSelectedOperationsLocalUnitId, OPERATIONS_SCOPE_COOKIE } from '@/lib/auth/operations-scope-selection'
import { listManageableEventIdsForUser } from '@/lib/auth/resource-access'
import { isAutomaticCouncilAdminTerm } from '@/lib/members/officer-roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  ACTING_COUNCIL_COOKIE,
  ACTING_MODE_COOKIE,
  ACTING_ORGANIZATION_COOKIE,
  ACTIVE_ACCESS_CONTEXT_COOKIE,
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
  activeLocalUnitId: string | null
  organizationId: string | null
  organizationName: string | null
  councilId: string | null
  personId: string | null
  email: string | null
  availableContexts: AccessContextOption[]
  activeContextKey: string | null
}

type AppUserRow = NonNullable<CurrentUserPermissions['appUser']>
type CouncilAdminAssignmentRow = { council_id: string | null; person_id: string | null }
type OrganizationAdminAssignmentRow = { organization_id: string | null; person_id: string | null }
type AutomaticCouncilAdminTermRow = {
  council_id: string | null
  office_scope_code: string
  office_code: string
}

type LinkedMemberRelationshipRow = {
  local_unit_id: string | null
  member_record?: {
    legacy_people_id: string | null
  } | null
  local_unit?: {
    legacy_council_id: string | null
    legacy_organization_id: string | null
  } | null
}

type CouncilProfileRow = {
  id: string
  organization_id: string | null
  name: string | null
  council_number: string | null
}

type OrganizationProfileRow = {
  id: string
  display_name: string | null
  preferred_name: string | null
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

type LocalUnitProfileRow = {
  id: string
  legacy_council_id: string | null
  legacy_organization_id: string | null
}

type EffectiveAdminPackageRow = {
  local_unit_id: string
  can_manage_members: boolean | null
  can_manage_events: boolean | null
  can_manage_custom_lists: boolean | null
  can_manage_claims: boolean | null
  can_manage_admins: boolean | null
  can_manage_local_unit_settings: boolean | null
}

type EffectiveAreaAccessRow = {
  local_unit_id: string
  area_code: 'members' | 'events' | 'custom_lists' | 'claims' | 'admins' | 'local_unit_settings'
  access_level: 'read_only' | 'edit_manage' | 'manage' | 'interact'
  is_effective: boolean | null
}

type EffectiveEventManagementRow = {
  local_unit_id: string
  is_effective: boolean | null
}

type ParallelUnitCapabilities = {
  members: boolean
  events: boolean
  eventResource: boolean
  customLists: boolean
  claims: boolean
  admins: boolean
  localUnitSettings: boolean
}

type ParallelAccessState = {
  contextSeeds: Array<{
    localUnitId: string
    organizationId: string | null
    councilId: string | null
    accessLevel: 'member' | 'admin' | 'manager'
    source: AccessContextSource
  }>
  councilProfiles: CouncilProfileRow[]
  organizationProfiles: OrganizationProfileRow[]
  capabilityByLocalUnitId: Map<string, ParallelUnitCapabilities>
  localUnitIdByContextKey: Map<string, string>
}

const PARALLEL_AREA_RULES: Array<{
  areaCode: 'members' | 'events' | 'custom_lists' | 'claims' | 'admins' | 'local_unit_settings'
  minimumAccessLevel: 'edit_manage' | 'manage'
  capabilityKey: keyof ParallelUnitCapabilities
}> = [
  { areaCode: 'members', minimumAccessLevel: 'edit_manage', capabilityKey: 'members' },
  { areaCode: 'events', minimumAccessLevel: 'manage', capabilityKey: 'events' },
  { areaCode: 'custom_lists', minimumAccessLevel: 'manage', capabilityKey: 'customLists' },
  { areaCode: 'claims', minimumAccessLevel: 'manage', capabilityKey: 'claims' },
  { areaCode: 'admins', minimumAccessLevel: 'manage', capabilityKey: 'admins' },
  { areaCode: 'local_unit_settings', minimumAccessLevel: 'manage', capabilityKey: 'localUnitSettings' },
]

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function buildPersonIdOrFilter(args: {
  userId: string
  personIds: string[]
  normalizedEmail: string | null
}) {
  const { userId, personIds, normalizedEmail } = args
  return [
    `user_id.eq.${userId}`,
    personIds.length > 0 ? `person_id.in.(${personIds.join(',')})` : '',
    normalizedEmail ? `grantee_email.eq.${normalizedEmail}` : '',
  ]
    .filter(Boolean)
    .join(',')
}

function createEmptyParallelUnitCapabilities(): ParallelUnitCapabilities {
  return {
    members: false,
    events: false,
    eventResource: false,
    customLists: false,
    claims: false,
    admins: false,
    localUnitSettings: false,
  }
}

function createFullManagementCapabilities(): ParallelUnitCapabilities {
  return {
    members: true,
    events: true,
    eventResource: true,
    customLists: true,
    claims: true,
    admins: true,
    localUnitSettings: true,
  }
}

function mergeCapabilities(
  ...capabilities: Array<ParallelUnitCapabilities | null | undefined>
): ParallelUnitCapabilities {
  return capabilities
    .filter((capability): capability is ParallelUnitCapabilities => Boolean(capability))
    .reduce<ParallelUnitCapabilities>(
      (merged, current) => ({
        members: merged.members || current.members,
        events: merged.events || current.events,
        eventResource: merged.eventResource || current.eventResource,
        customLists: merged.customLists || current.customLists,
        claims: merged.claims || current.claims,
        admins: merged.admins || current.admins,
        localUnitSettings: merged.localUnitSettings || current.localUnitSettings,
      }),
      createEmptyParallelUnitCapabilities()
    )
}

function pickPreferredLocalUnitId(args: {
  availableContexts: AccessContextOption[]
  requestedAccessContextKey: string | null
  requestedOperationsLocalUnitId: string | null
  fallbackLocalUnitId: string | null
}): string | null {
  const { availableContexts, requestedAccessContextKey, requestedOperationsLocalUnitId, fallbackLocalUnitId } = args

  const selectedAccessContext = requestedAccessContextKey
    ? availableContexts.find((context) => context.key === requestedAccessContextKey) ?? null
    : null

  if (selectedAccessContext?.localUnitId) {
    return selectedAccessContext.localUnitId
  }

  if (requestedOperationsLocalUnitId) {
    const matchingOperationsContext = availableContexts.find(
      (context) => context.accessLevel !== 'member' && context.localUnitId === requestedOperationsLocalUnitId
    )
    if (matchingOperationsContext?.localUnitId) {
      return matchingOperationsContext.localUnitId
    }
  }

  const highestStaffContext = pickDefaultAccessContext(
    availableContexts.filter((context) => context.accessLevel !== 'member')
  )
  if (highestStaffContext?.localUnitId) {
    return highestStaffContext.localUnitId
  }

  const defaultContext = pickDefaultAccessContext(availableContexts)
  if (defaultContext?.localUnitId) {
    return defaultContext.localUnitId
  }

  return fallbackLocalUnitId
}

async function loadParallelAccessState(args: {
  admin: ReturnType<typeof createAdminClient>
  userId: string
}): Promise<ParallelAccessState> {
  const { admin, userId } = args

  const capabilityByLocalUnitId = new Map<string, ParallelUnitCapabilities>()

  function remember(localUnitId: string) {
    const existing = capabilityByLocalUnitId.get(localUnitId)
    if (existing) return existing

    const next = createEmptyParallelUnitCapabilities()
    capabilityByLocalUnitId.set(localUnitId, next)
    return next
  }

  let loadedFromAdminPackageView = false

  try {
    const { data, error } = await admin
      .from('v_effective_admin_package_access')
      .select([
        'local_unit_id',
        'can_manage_members',
        'can_manage_events',
        'can_manage_custom_lists',
        'can_manage_claims',
        'can_manage_admins',
        'can_manage_local_unit_settings',
      ].join(', '))
      .eq('user_id', userId)

    if (error) {
      throw error
    }

    const rows = (data as unknown as EffectiveAdminPackageRow[] | null) ?? []
    for (const row of rows) {
      if (!row.local_unit_id) continue
      const capabilities = remember(row.local_unit_id)
      capabilities.members = capabilities.members || Boolean(row.can_manage_members)
      capabilities.events = capabilities.events || Boolean(row.can_manage_events)
      capabilities.customLists = capabilities.customLists || Boolean(row.can_manage_custom_lists)
      capabilities.claims = capabilities.claims || Boolean(row.can_manage_claims)
      capabilities.admins = capabilities.admins || Boolean(row.can_manage_admins)
      capabilities.localUnitSettings = capabilities.localUnitSettings || Boolean(row.can_manage_local_unit_settings)
    }

    loadedFromAdminPackageView = true
  } catch {
    loadedFromAdminPackageView = false
  }

  if (!loadedFromAdminPackageView) {
    let loadedFromEffectiveAreaView = false

    try {
      const { data, error } = await admin
        .from('v_effective_area_access')
        .select('local_unit_id, area_code, access_level, is_effective')
        .eq('user_id', userId)
        .eq('is_effective', true)

      if (error) {
        throw error
      }

      const rows = (data as unknown as EffectiveAreaAccessRow[] | null) ?? []
      for (const row of rows) {
        if (!row.local_unit_id || row.is_effective === false) continue
        const capabilities = remember(row.local_unit_id)

        if (row.area_code === 'members' && (row.access_level === 'edit_manage' || row.access_level === 'manage')) {
          capabilities.members = true
        }

        if (row.area_code === 'events' && row.access_level === 'manage') {
          capabilities.events = true
        }

        if (row.area_code === 'custom_lists' && row.access_level === 'manage') {
          capabilities.customLists = true
        }

        if (row.area_code === 'claims' && row.access_level === 'manage') {
          capabilities.claims = true
        }

        if (row.area_code === 'admins' && row.access_level === 'manage') {
          capabilities.admins = true
        }

        if (row.area_code === 'local_unit_settings' && row.access_level === 'manage') {
          capabilities.localUnitSettings = true
        }
      }

      loadedFromEffectiveAreaView = rows.length > 0
    } catch {
      loadedFromEffectiveAreaView = false
    }

    if (!loadedFromEffectiveAreaView) {
      const areaResults = await Promise.all(
        PARALLEL_AREA_RULES.map(async (rule) => {
          try {
            const rows = await listAccessibleLocalUnitsForArea({
              admin,
              userId,
              areaCode: rule.areaCode,
              minimumAccessLevel: rule.minimumAccessLevel,
            })

            return { rule, rows }
          } catch {
            return { rule, rows: [] }
          }
        })
      )

      for (const result of areaResults) {
        for (const row of result.rows) {
          remember(row.local_unit_id)[result.rule.capabilityKey] = true
        }
      }
    }
  }

  let loadedEventResourcesFromView = false

  try {
    const { data, error } = await admin
      .from('v_effective_event_management_access')
      .select('local_unit_id, is_effective')
      .eq('user_id', userId)
      .eq('is_effective', true)

    if (error) {
      throw error
    }

    const rows = (data as unknown as EffectiveEventManagementRow[] | null) ?? []
    for (const row of rows) {
      if (!row.local_unit_id || row.is_effective === false) continue
      remember(row.local_unit_id).eventResource = true
    }

    loadedEventResourcesFromView = rows.length > 0
  } catch {
    loadedEventResourcesFromView = false
  }

  if (!loadedEventResourcesFromView) {
    const manageableEvents = await listManageableEventIdsForUser({
      admin,
      userId,
      localUnitId: null,
    }).catch(() => [])

    for (const row of manageableEvents) {
      if (!row.local_unit_id) continue
      remember(row.local_unit_id).eventResource = true
    }
  }

  const localUnitIds = [...capabilityByLocalUnitId.keys()]
  if (localUnitIds.length === 0) {
    return {
      contextSeeds: [],
      councilProfiles: [],
      organizationProfiles: [],
      capabilityByLocalUnitId,
      localUnitIdByContextKey: new Map<string, string>(),
    }
  }

  const { data: localUnitData, error: localUnitError } = await admin
    .from('local_units')
    .select('id, legacy_council_id, legacy_organization_id')
    .in('id', localUnitIds)

  if (localUnitError) {
    throw new Error(`Could not load parallel access local units: ${localUnitError.message}`)
  }

  const localUnits = (localUnitData as LocalUnitProfileRow[] | null) ?? []
  const councilIds = uniqueStrings(localUnits.map((row) => row.legacy_council_id))

  const councilProfiles =
    councilIds.length > 0
      ? ((
          await admin
            .from('councils')
            .select('id, organization_id, name, council_number')
            .in('id', councilIds)
        ).data as CouncilProfileRow[] | null) ?? []
      : []

  const councilMap = new Map(councilProfiles.map((row) => [row.id, row]))
  const organizationIds = uniqueStrings([
    ...localUnits.map((row) => row.legacy_organization_id),
    ...councilProfiles.map((row) => row.organization_id),
  ])

  const organizationProfiles =
    organizationIds.length > 0
      ? ((
          await admin
            .from('organizations')
            .select('id, display_name, preferred_name')
            .in('id', organizationIds)
        ).data as OrganizationProfileRow[] | null) ?? []
      : []

  const contextSeeds: ParallelAccessState['contextSeeds'] = []
  const localUnitIdByContextKey = new Map<string, string>()

  for (const localUnit of localUnits) {
    const capabilities = capabilityByLocalUnitId.get(localUnit.id)
    if (!capabilities) continue

    const council = localUnit.legacy_council_id ? councilMap.get(localUnit.legacy_council_id) ?? null : null
    const organizationId = localUnit.legacy_organization_id ?? council?.organization_id ?? null
    const accessLevel = capabilities.admins || capabilities.localUnitSettings ? 'manager' : 'admin'
    const source: AccessContextSource = capabilities.eventResource && !capabilities.events
      ? 'parallel_event_access'
      : 'parallel_area_access'

    contextSeeds.push({
      localUnitId: localUnit.id,
      organizationId,
      councilId: localUnit.legacy_council_id,
      accessLevel,
      source,
    })

    const contextKey = buildAccessContextKey({
      localUnitId: localUnit.id,
      organizationId,
      councilId: localUnit.legacy_council_id,
      accessLevel,
    })

    if (!localUnitIdByContextKey.has(contextKey)) {
      localUnitIdByContextKey.set(contextKey, localUnit.id)
    }
  }

  return {
    contextSeeds,
    councilProfiles,
    organizationProfiles,
    capabilityByLocalUnitId,
    localUnitIdByContextKey,
  }
}

async function tryResolveActiveLocalUnitId(args: {
  admin: ReturnType<typeof createAdminClient>
  councilId?: string | null
  organizationId?: string | null
}) {
  const { admin, councilId = null, organizationId = null } = args

  try {
    if (councilId) {
      const { data } = await admin
        .from('local_units')
        .select('id')
        .eq('legacy_council_id', councilId)
        .limit(1)
        .maybeSingle()
      const row = data as { id: string } | null
      if (row?.id) return row.id
    }

    if (organizationId) {
      const { data } = await admin
        .from('local_units')
        .select('id, local_unit_kind')
        .eq('legacy_organization_id', organizationId)
        .order('local_unit_kind', { ascending: true })
        .limit(1)
      const rows = (data as Array<{ id: string; local_unit_kind?: string | null }> | null) ?? []
      if (rows[0]?.id) return rows[0].id
    }
  } catch {
    return null
  }

  return null
}

async function ensureAppUserRow(args: {
  admin: ReturnType<typeof createAdminClient>
  authUserId: string
  existingAppUser: AppUserRow | null
  personId?: string | null
  isSuperAdmin?: boolean
}) {
  const {
    admin,
    authUserId,
    existingAppUser,
    personId = null,
    isSuperAdmin = false,
  } = args

  const needsInsert = !existingAppUser
  const needsSync =
    !needsInsert &&
    ((personId && existingAppUser.person_id !== personId) ||
      (isSuperAdmin && !existingAppUser.is_super_admin) ||
      existingAppUser.is_active === false)

  if (!needsInsert && !needsSync) {
    return existingAppUser
  }

  const payload = {
    id: authUserId,
    person_id: personId ?? existingAppUser?.person_id ?? null,
    is_active: existingAppUser?.is_active ?? true,
    is_super_admin: isSuperAdmin || existingAppUser?.is_super_admin || false,
  }

  const { data, error } = await admin
    .from('users')
    .upsert(payload, { onConflict: 'id' })
    .select('id, person_id, is_active, is_super_admin')
    .maybeSingle()

  if (error) {
    throw new Error(`Could not provision app user row: ${error.message}`)
  }

  return (data as AppUserRow | null) ?? {
    id: authUserId,
    person_id: payload.person_id,
    is_active: payload.is_active,
    is_super_admin: payload.is_super_admin,
  }
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
      activeLocalUnitId: null,
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
    .select('id, person_id, is_active, is_super_admin')
    .eq('id', user.id)
    .maybeSingle()

  let appUser = (appUserData as AppUserRow | null) ?? null
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
      .limit(10)

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

  let personId = appUser?.person_id ?? derivedOfficerEmailPersonId ?? null

  const { data: linkedRelationshipData } = await admin
    .from('user_unit_relationships')
    .select(
      'local_unit_id, member_record:member_record_id(legacy_people_id), local_unit:local_unit_id(legacy_council_id, legacy_organization_id)'
    )
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(50)

  const linkedMemberRelationships =
    ((linkedRelationshipData as LinkedMemberRelationshipRow[] | null) ?? []).filter(
      (row): row is LinkedMemberRelationshipRow & { local_unit_id: string } => Boolean(row.local_unit_id)
    )

  const linkedMemberRelationshipPersonIds = uniqueStrings(
    linkedMemberRelationships.map((row) => row.member_record?.legacy_people_id ?? null)
  )

  const identitySeedPersonIds = uniqueStrings([
    appUser?.person_id,
    derivedOfficerEmailPersonId,
    ...linkedMemberRelationshipPersonIds,
  ])

  let linkedIdentityPersonIds = [...identitySeedPersonIds]

  if (identitySeedPersonIds.length > 0) {
    const { data: identitySeedData } = await admin
      .from('person_identity_links')
      .select('person_identity_id')
      .in('person_id', identitySeedPersonIds)
      .is('ended_at', null)

    const identityIds = uniqueStrings(
      ((identitySeedData as Array<{ person_identity_id: string | null }> | null) ?? []).map(
        (row) => row.person_identity_id
      )
    )

    if (identityIds.length > 0) {
      const { data: identityLinkData } = await admin
        .from('person_identity_links')
        .select('person_id')
        .in('person_identity_id', identityIds)
        .is('ended_at', null)

      linkedIdentityPersonIds = uniqueStrings([
        ...identitySeedPersonIds,
        ...(((identityLinkData as Array<{ person_id: string | null }> | null) ?? []).map((row) => row.person_id)),
      ])
    }
  }

  if (!personId) {
    personId =
      linkedMemberRelationshipPersonIds[0] ??
      linkedIdentityPersonIds[0] ??
      null
  }

  const [councilAdminAssignmentResult, organizationAdminAssignmentResult, automaticCouncilAdminTermResult] =
    await Promise.all([
      admin
        .from('council_admin_assignments')
        .select('council_id, person_id')
        .eq('is_active', true)
        .or(buildPersonIdOrFilter({
          userId: user.id,
          personIds: linkedIdentityPersonIds,
          normalizedEmail,
        }))
        .limit(25),
      admin
        .from('organization_admin_assignments')
        .select('organization_id, person_id')
        .eq('is_active', true)
        .or(buildPersonIdOrFilter({
          userId: user.id,
          personIds: linkedIdentityPersonIds,
          normalizedEmail,
        }))
        .limit(25),
      linkedIdentityPersonIds.length > 0
        ? admin
            .from('person_officer_terms')
            .select('council_id, office_scope_code, office_code')
            .in('person_id', linkedIdentityPersonIds)
            .or(`service_end_year.is.null,service_end_year.gte.${currentYear}`)
            .limit(25)
        : Promise.resolve({ data: [] as AutomaticCouncilAdminTermRow[] }),
    ])

  const councilAdminAssignments =
    (councilAdminAssignmentResult.data as CouncilAdminAssignmentRow[] | null)?.filter(
      (row): row is CouncilAdminAssignmentRow & { council_id: string } => Boolean(row.council_id)
    ) ?? []

  const organizationAdminAssignments =
    (organizationAdminAssignmentResult.data as OrganizationAdminAssignmentRow[] | null)?.filter(
      (row): row is OrganizationAdminAssignmentRow & { organization_id: string } =>
        Boolean(row.organization_id)
    ) ?? []

  const automaticCouncilAdminTerms =
    (automaticCouncilAdminTermResult.data as AutomaticCouncilAdminTermRow[] | null)?.filter(
      (term): term is AutomaticCouncilAdminTermRow & { council_id: string } =>
        Boolean(term.council_id) && isAutomaticCouncilAdminTerm(term)
    ) ?? []

  if (!personId) {
    personId =
      councilAdminAssignments.find((assignment) => assignment.person_id)?.person_id ??
      organizationAdminAssignments.find((assignment) => assignment.person_id)?.person_id ??
      linkedIdentityPersonIds[0] ??
      null
  }

  const memberLocalUnitSeeds = linkedMemberRelationships.reduce<Array<{
    localUnitId: string
    organizationId: string | null
    councilId: string | null
  }>>((accumulator, row) => {
    const localUnitId = row.local_unit_id
    if (!localUnitId) return accumulator
    if (accumulator.some((seed) => seed.localUnitId == localUnitId)) {
      return accumulator
    }

    accumulator.push({
      localUnitId,
      organizationId: row.local_unit?.legacy_organization_id ?? null,
      councilId: row.local_unit?.legacy_council_id ?? null,
    })

    return accumulator
  }, [])

  const parallelAccessState = await loadParallelAccessState({
    admin,
    userId: user.id,
  })

  const assignmentCouncilIds = uniqueStrings([
    ...councilAdminAssignments.map((assignment) => assignment.council_id),
    ...automaticCouncilAdminTerms.map((term) => term.council_id),
  ])
  const assignmentOrganizationIds = uniqueStrings(
    organizationAdminAssignments.map((assignment) => assignment.organization_id)
  )

  const [assignmentCouncilLocalUnitResult, assignmentOrganizationLocalUnitResult] = await Promise.all([
    assignmentCouncilIds.length > 0
      ? admin
          .from('local_units')
          .select('id, legacy_council_id, legacy_organization_id')
          .in('legacy_council_id', assignmentCouncilIds)
      : Promise.resolve({ data: [] as LocalUnitProfileRow[], error: null }),
    assignmentOrganizationIds.length > 0
      ? admin
          .from('local_units')
          .select('id, legacy_council_id, legacy_organization_id')
          .in('legacy_organization_id', assignmentOrganizationIds)
      : Promise.resolve({ data: [] as LocalUnitProfileRow[], error: null }),
  ])

  if (assignmentCouncilLocalUnitResult.error) {
    throw new Error(`Could not load council-scoped admin local units: ${assignmentCouncilLocalUnitResult.error.message}`)
  }

  if (assignmentOrganizationLocalUnitResult.error) {
    throw new Error(
      `Could not load organization-scoped admin local units: ${assignmentOrganizationLocalUnitResult.error.message}`
    )
  }

  const councilScopedAdminLocalUnits =
    (assignmentCouncilLocalUnitResult.data as LocalUnitProfileRow[] | null) ?? []
  const organizationScopedAdminLocalUnits =
    (assignmentOrganizationLocalUnitResult.data as LocalUnitProfileRow[] | null) ?? []

  const directAssignmentCapabilitiesByLocalUnitId = new Map<string, ParallelUnitCapabilities>()

  function rememberDirectAssignmentCapability(localUnitId: string) {
    const existing = directAssignmentCapabilitiesByLocalUnitId.get(localUnitId)
    if (existing) return existing

    const next = createFullManagementCapabilities()
    directAssignmentCapabilitiesByLocalUnitId.set(localUnitId, next)
    return next
  }

  const directAssignmentSeeds: Array<{
    localUnitId?: string | null
    organizationId: string | null
    councilId: string | null
    accessLevel: 'member' | 'admin' | 'manager'
    source: AccessContextSource
  }> = []

  for (const assignment of councilAdminAssignments) {
    const matchingLocalUnits = councilScopedAdminLocalUnits.filter(
      (row) => row.legacy_council_id === assignment.council_id
    )

    if (matchingLocalUnits.length === 0) {
      directAssignmentSeeds.push({
        organizationId: null,
        councilId: assignment.council_id,
        accessLevel: 'manager',
        source: 'council_admin_assignment',
      })
      continue
    }

    for (const localUnit of matchingLocalUnits) {
      rememberDirectAssignmentCapability(localUnit.id)
      directAssignmentSeeds.push({
        localUnitId: localUnit.id,
        organizationId: localUnit.legacy_organization_id ?? null,
        councilId: localUnit.legacy_council_id ?? null,
        accessLevel: 'manager',
        source: 'council_admin_assignment',
      })
    }
  }

  for (const term of automaticCouncilAdminTerms) {
    const matchingLocalUnits = councilScopedAdminLocalUnits.filter(
      (row) => row.legacy_council_id === term.council_id
    )

    if (matchingLocalUnits.length === 0) {
      directAssignmentSeeds.push({
        organizationId: null,
        councilId: term.council_id,
        accessLevel: 'manager',
        source: 'officer_term',
      })
      continue
    }

    for (const localUnit of matchingLocalUnits) {
      rememberDirectAssignmentCapability(localUnit.id)
      directAssignmentSeeds.push({
        localUnitId: localUnit.id,
        organizationId: localUnit.legacy_organization_id ?? null,
        councilId: localUnit.legacy_council_id ?? null,
        accessLevel: 'manager',
        source: 'officer_term',
      })
    }
  }

  for (const assignment of organizationAdminAssignments) {
    const matchingLocalUnits = organizationScopedAdminLocalUnits.filter(
      (row) => row.legacy_organization_id === assignment.organization_id
    )

    if (matchingLocalUnits.length === 0) {
      directAssignmentSeeds.push({
        organizationId: assignment.organization_id,
        councilId: null,
        accessLevel: 'manager',
        source: 'organization_admin_assignment',
      })
      continue
    }

    for (const localUnit of matchingLocalUnits) {
      rememberDirectAssignmentCapability(localUnit.id)
      directAssignmentSeeds.push({
        localUnitId: localUnit.id,
        organizationId: localUnit.legacy_organization_id ?? assignment.organization_id,
        councilId: localUnit.legacy_council_id ?? null,
        accessLevel: 'manager',
        source: 'organization_admin_assignment',
      })
    }
  }

  const directCouncilIds = uniqueStrings([
    ...memberLocalUnitSeeds.map((seed) => seed.councilId),
    ...assignmentCouncilIds,
    derivedOfficerEmailCouncilId,
    ...councilAdminAssignments.map((assignment) => assignment.council_id),
    ...automaticCouncilAdminTerms.map((term) => term.council_id),
  ])

  const directOrganizationIds = uniqueStrings([
    ...organizationAdminAssignments.map((assignment) => assignment.organization_id),
    ...memberLocalUnitSeeds.map((seed) => seed.organizationId),
  ])

  const [directCouncilProfilesResult, organizationCouncilProfilesResult] = await Promise.all([
    directCouncilIds.length > 0
      ? admin
          .from('councils')
          .select('id, organization_id, name, council_number')
          .in('id', directCouncilIds)
      : Promise.resolve({ data: [] as CouncilProfileRow[] }),
    directOrganizationIds.length > 0
      ? admin
          .from('councils')
          .select('id, organization_id, name, council_number')
          .in('organization_id', directOrganizationIds)
      : Promise.resolve({ data: [] as CouncilProfileRow[] }),
  ])

  const councilProfiles = [
    ...((directCouncilProfilesResult.data as CouncilProfileRow[] | null) ?? []),
    ...((organizationCouncilProfilesResult.data as CouncilProfileRow[] | null) ?? []),
    ...parallelAccessState.councilProfiles,
  ].filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index)

  const organizationIds = uniqueStrings([
    ...directOrganizationIds,
    ...councilProfiles.map((council) => council.organization_id),
  ])

  const organizationProfiles =
    organizationIds.length > 0
      ? (((await admin
          .from('organizations')
          .select('id, display_name, preferred_name')
          .in('id', organizationIds)
        ).data as OrganizationProfileRow[] | null) ?? [])
      : []

  const mergedOrganizationProfiles = [
    ...organizationProfiles,
    ...parallelAccessState.organizationProfiles,
  ].filter((row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index)

  const accessSeeds: Array<{
    localUnitId?: string | null
    organizationId: string | null
    councilId: string | null
    accessLevel: 'member' | 'admin' | 'manager'
    source: AccessContextSource
  }> = []

  accessSeeds.push(
    ...memberLocalUnitSeeds.map((seed) => ({
      localUnitId: seed.localUnitId,
      organizationId: seed.organizationId,
      councilId: seed.councilId,
      accessLevel: 'member' as const,
      source: 'app_user' as const,
    }))
  )

  accessSeeds.push(...directAssignmentSeeds)
  accessSeeds.push(...parallelAccessState.contextSeeds)

  const availableContexts = buildAccessContexts({
    seeds: accessSeeds,
    councils: councilProfiles,
    organizations: mergedOrganizationProfiles,
  })

  const defaultContext = pickDefaultAccessContext(availableContexts)

  const defaultMemberSeed = memberLocalUnitSeeds[0] ?? null
  const defaultCouncilId =
    defaultContext?.councilId ??
    defaultMemberSeed?.councilId ??
    derivedOfficerEmailCouncilId ??
    null
  const defaultOrganizationId =
    defaultContext?.organizationId ??
    defaultMemberSeed?.organizationId ??
    councilProfiles.find((council) => council.id === defaultCouncilId)?.organization_id ??
    null
  const defaultOrganizationName =
    defaultContext?.organizationName ??
    mergedOrganizationProfiles.find((organization) => organization.id === defaultOrganizationId)?.preferred_name ??
    mergedOrganizationProfiles.find((organization) => organization.id === defaultOrganizationId)?.display_name ??
    null

  const identityAnchorPersonId = personId

  appUser = await ensureAppUserRow({
    admin,
    authUserId: user.id,
    existingAppUser: appUser,
    personId: identityAnchorPersonId,
    isSuperAdmin,
  })

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
  const requestedAccessContextKey = !isSuperAdmin
    ? cookieStore.get(ACTIVE_ACCESS_CONTEXT_COOKIE)?.value ?? null
    : null
  const requestedOperationsLocalUnitId = !isSuperAdmin
    ? getSelectedOperationsLocalUnitId({
        rawCookieValue: cookieStore.get(OPERATIONS_SCOPE_COOKIE)?.value ?? null,
      })
    : null

  const selectedAccessContext = !isSuperAdmin && requestedAccessContextKey
    ? availableContexts.find((context) => context.key === requestedAccessContextKey) ?? null
    : null
  const selectedOperationsContext = !isSuperAdmin && requestedOperationsLocalUnitId
    ? pickDefaultAccessContext(
        availableContexts.filter(
          (context) =>
            context.accessLevel !== 'member' &&
            (context.localUnitId === requestedOperationsLocalUnitId ||
              parallelAccessState.localUnitIdByContextKey.get(context.key) === requestedOperationsLocalUnitId)
        )
      )
    : null
  const highestStaffContext = !isSuperAdmin
    ? pickDefaultAccessContext(availableContexts.filter((context) => context.accessLevel !== 'member'))
    : null
  const activeAccessContext = !isSuperAdmin && highestStaffContext && selectedAccessContext?.accessLevel === 'member'
    ? highestStaffContext
    : selectedAccessContext ?? selectedOperationsContext ?? defaultContext

  let organizationId: string | null = activeAccessContext?.organizationId ?? defaultOrganizationId
  let organizationName: string | null = activeAccessContext?.organizationName ?? defaultOrganizationName
  let councilId: string | null = activeAccessContext?.councilId ?? defaultCouncilId
  let isOrganizationMember = availableContexts.length > 0 || Boolean(defaultOrganizationId || defaultCouncilId)
  let hasStaffAccess = false
  let isCouncilAdmin = false
  let canAccessMemberData = false
  let canManageEvents = false
  let canAccessOfficerDirectory = false
  let canManageCustomLists = false
  let canReviewMemberChanges = false
  let canImportMembers = false
  let canAccessOrganizationSettings = false
  let canManageAdmins = false
  const canReviewClaims = isSuperAdmin

  if (isSuperAdmin && actingMode !== 'normal') {
    organizationId = requestedOrganizationId ?? defaultOrganizationId
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
      const linkedCouncil = councilProfiles.find((council) => council.organization_id === organizationId)
      councilId = linkedCouncil?.id ?? null
    }

    const actingAsAdmin = actingMode === 'admin' && Boolean(councilId || organizationId)
    const actingWithOrganizationSettings = Boolean(organizationId || councilId) && actingMode !== 'member'

    isOrganizationMember = Boolean(organizationId || councilId)
    hasStaffAccess = actingAsAdmin
    isCouncilAdmin = actingAsAdmin
    canAccessMemberData = actingAsAdmin
    canManageEvents = actingAsAdmin
    canAccessOfficerDirectory = actingAsAdmin
    canManageCustomLists = actingAsAdmin
    canReviewMemberChanges = actingAsAdmin
    canImportMembers = actingAsAdmin
    canAccessOrganizationSettings = actingWithOrganizationSettings
    canManageAdmins = actingAsAdmin
  }

  const shouldApplyRealAccessCapabilities =
    !(isSuperAdmin && actingMode !== 'normal')

  const aggregatedParallelCapabilities = [...parallelAccessState.capabilityByLocalUnitId.values()].reduce(
    (accumulator, capabilities) => ({
      members: accumulator.members || capabilities.members,
      events: accumulator.events || capabilities.events,
      eventResource: accumulator.eventResource || capabilities.eventResource,
      customLists: accumulator.customLists || capabilities.customLists,
      claims: accumulator.claims || capabilities.claims,
      admins: accumulator.admins || capabilities.admins,
      localUnitSettings: accumulator.localUnitSettings || capabilities.localUnitSettings,
    }),
    createEmptyParallelUnitCapabilities()
  )

  const aggregatedDirectAssignmentCapabilities = [...directAssignmentCapabilitiesByLocalUnitId.values()].reduce(
    (accumulator, capabilities) => mergeCapabilities(accumulator, capabilities),
    createEmptyParallelUnitCapabilities()
  )

  const aggregatedCapabilities = mergeCapabilities(
    aggregatedParallelCapabilities,
    aggregatedDirectAssignmentCapabilities
  )

  const fallbackLocalUnitId =
    defaultMemberSeed?.localUnitId ??
    activeAccessContext?.localUnitId ??
    requestedOperationsLocalUnitId ??
    null

  let activeLocalUnitId =
    isSuperAdmin && actingMode !== 'normal'
      ? await tryResolveActiveLocalUnitId({
          admin,
          councilId,
          organizationId,
        })
      : pickPreferredLocalUnitId({
          availableContexts,
          requestedAccessContextKey,
          requestedOperationsLocalUnitId,
          fallbackLocalUnitId,
        })

  if (!activeLocalUnitId && !(isSuperAdmin && actingMode !== 'normal')) {
    activeLocalUnitId = await tryResolveActiveLocalUnitId({
      admin,
      councilId,
      organizationId,
    })
  }

  if (shouldApplyRealAccessCapabilities && activeLocalUnitId && !(isSuperAdmin && actingMode === 'member')) {
    const activeCapabilities = mergeCapabilities(
      parallelAccessState.capabilityByLocalUnitId.get(activeLocalUnitId) ?? null,
      directAssignmentCapabilitiesByLocalUnitId.get(activeLocalUnitId) ?? null
    )

    const resolvedMemberManage = activeCapabilities.members
    const resolvedEventsManage = activeCapabilities.events
    const resolvedClaimsManage = activeCapabilities.claims
    const resolvedCustomListsManage = activeCapabilities.customLists
    const resolvedAdminsManage = activeCapabilities.admins
    const resolvedLocalUnitSettingsManage = activeCapabilities.localUnitSettings
    const resolvedEventCapability = resolvedEventsManage || activeCapabilities.eventResource

    canAccessMemberData = resolvedMemberManage
    canManageEvents = resolvedEventCapability
    canAccessOfficerDirectory = resolvedMemberManage
    canReviewMemberChanges = resolvedMemberManage || resolvedClaimsManage
    canImportMembers = resolvedMemberManage
    canManageCustomLists = resolvedCustomListsManage
    canAccessOrganizationSettings = resolvedLocalUnitSettingsManage || resolvedAdminsManage
    canManageAdmins = resolvedAdminsManage

    hasStaffAccess =
      resolvedMemberManage ||
      resolvedEventCapability ||
      resolvedCustomListsManage ||
      resolvedClaimsManage ||
      resolvedAdminsManage ||
      resolvedLocalUnitSettingsManage

    isCouncilAdmin = resolvedMemberManage
  }

  if (shouldApplyRealAccessCapabilities && (!activeLocalUnitId || !hasStaffAccess) && !(isSuperAdmin && actingMode === 'member')) {
    const resolvedMemberManage = aggregatedCapabilities.members
    const resolvedEventsManage = aggregatedCapabilities.events
    const resolvedClaimsManage = aggregatedCapabilities.claims
    const resolvedCustomListsManage = aggregatedCapabilities.customLists
    const resolvedAdminsManage = aggregatedCapabilities.admins
    const resolvedLocalUnitSettingsManage = aggregatedCapabilities.localUnitSettings
    const resolvedEventCapability = resolvedEventsManage || aggregatedCapabilities.eventResource

    if (
      resolvedMemberManage ||
      resolvedEventCapability ||
      resolvedCustomListsManage ||
      resolvedClaimsManage ||
      resolvedAdminsManage ||
      resolvedLocalUnitSettingsManage
    ) {
      canAccessMemberData = resolvedMemberManage
      canManageEvents = resolvedEventCapability
      canAccessOfficerDirectory = resolvedMemberManage
      canReviewMemberChanges = resolvedMemberManage || resolvedClaimsManage
      canImportMembers = resolvedMemberManage
      canManageCustomLists = resolvedCustomListsManage
      canAccessOrganizationSettings = resolvedLocalUnitSettingsManage || resolvedAdminsManage
      canManageAdmins = resolvedAdminsManage
      hasStaffAccess = true
      isCouncilAdmin = resolvedMemberManage
    }
  }

  if (isSuperAdmin && actingMode === 'member') {
    hasStaffAccess = false
    isCouncilAdmin = false
    canAccessMemberData = false
    canManageEvents = false
    canAccessOfficerDirectory = false
    canManageCustomLists = false
    canReviewMemberChanges = false
    canImportMembers = false
    canAccessOrganizationSettings = false
    canManageAdmins = false
  }

  if (activeLocalUnitId && !(isSuperAdmin && actingMode === 'member')) {
    const { data: activeLocalUnitData } = await admin
      .from('local_units')
      .select('id, legacy_council_id, legacy_organization_id')
      .eq('id', activeLocalUnitId)
      .maybeSingle<LocalUnitProfileRow>()

    const activeLocalUnit = (activeLocalUnitData as LocalUnitProfileRow | null) ?? null
    if (activeLocalUnit) {
      councilId = activeLocalUnit.legacy_council_id ?? councilId
      organizationId =
        activeLocalUnit.legacy_organization_id ??
        councilProfiles.find((council) => council.id === councilId)?.organization_id ??
        organizationId

      const scopedOrganization = organizationId
        ? mergedOrganizationProfiles.find((organization) => organization.id === organizationId) ?? null
        : null

      organizationName =
        scopedOrganization?.preferred_name ??
        scopedOrganization?.display_name ??
        organizationName
    }
  }

  let scopedPersonId = personId

  if (activeLocalUnitId) {
    const relationshipScopedPersonId =
      linkedMemberRelationships.find(
        (row) => row.local_unit_id === activeLocalUnitId && row.member_record?.legacy_people_id
      )?.member_record?.legacy_people_id ?? null

    if (relationshipScopedPersonId) {
      scopedPersonId = relationshipScopedPersonId
    } else if (linkedIdentityPersonIds.length > 0) {
      const { data: scopedMemberRecordData } = await admin
        .from('member_records')
        .select('legacy_people_id')
        .eq('local_unit_id', activeLocalUnitId)
        .in('legacy_people_id', linkedIdentityPersonIds)
        .is('archived_at', null)
        .limit(1)
        .maybeSingle()

      const scopedMemberRecord = scopedMemberRecordData as { legacy_people_id: string | null } | null
      if (scopedMemberRecord?.legacy_people_id) {
        scopedPersonId = scopedMemberRecord.legacy_people_id
      }
    }
  }

  const currentViewLabel = isSuperAdmin
    ? getSuperAdminViewLabel({ mode: actingMode, organizationName })
    : activeAccessContext && defaultContext && activeAccessContext.key !== defaultContext.key
      ? activeAccessContext.label
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
    isOrganizationMember,
    hasStaffAccess,
    isCouncilAdmin,
    canAccessMemberData,
    canManageEvents,
    canAccessOfficerDirectory,
    canManageCustomLists,
    canReviewMemberChanges,
    canImportMembers,
    canAccessOrganizationSettings,
    canManageAdmins,
    canReviewClaims,
    isSuperAdmin,
    actingMode,
    isDevMode: actingMode !== 'normal',
    currentViewLabel,
    activeLocalUnitId,
    organizationId,
    organizationName,
    councilId,
    personId: scopedPersonId,
    email: normalizedEmail,
    availableContexts,
    activeContextKey: activeAccessContext?.key ?? null,
  }
}
