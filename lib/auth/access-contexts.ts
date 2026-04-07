export type AccessContextLevel = 'member' | 'admin' | 'manager'
export type AccessContextSource =
  | 'linked_person'
  | 'app_user'
  | 'council_admin_assignment'
  | 'organization_admin_assignment'
  | 'officer_term'
  | 'parallel_area_access'
  | 'parallel_event_access'

export type AccessContextOption = {
  key: string
  localUnitId: string | null
  organizationId: string | null
  organizationName: string | null
  councilId: string | null
  councilName: string | null
  councilNumber: string | null
  accessLevel: AccessContextLevel
  label: string
  shortLabel: string
  description: string
  sources: AccessContextSource[]
}

type CouncilProfile = {
  id: string
  organization_id: string | null
  name: string | null
  council_number: string | null
}

type OrganizationProfile = {
  id: string
  display_name: string | null
  preferred_name: string | null
}

type AccessContextSeed = {
  localUnitId?: string | null
  organizationId: string | null
  councilId: string | null
  accessLevel: AccessContextLevel
  source: AccessContextSource
}

const ACCESS_LEVEL_PRIORITY: Record<AccessContextLevel, number> = {
  manager: 3,
  admin: 2,
  member: 1,
}

function clean(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function organizationLabel(organization?: Pick<OrganizationProfile, 'preferred_name' | 'display_name'> | null) {
  return clean(organization?.preferred_name) ?? clean(organization?.display_name) ?? null
}

function councilLabel(council?: Pick<CouncilProfile, 'name' | 'council_number'> | null) {
  if (!council) return null
  const name = clean(council.name)
  const councilNumber = clean(council.council_number)
  if (name && councilNumber) return `${name} (${councilNumber})`
  return name ?? (councilNumber ? `Council ${councilNumber}` : null)
}

function accessLevelLabel(accessLevel: AccessContextLevel) {
  if (accessLevel === 'manager') return 'Manager'
  if (accessLevel === 'admin') return 'Admin'
  return 'Member'
}

export function buildAccessContextKey(args: {
  localUnitId?: string | null
  organizationId?: string | null
  councilId?: string | null
  accessLevel: AccessContextLevel
}) {
  const baseKey = [args.organizationId ?? 'org:none', args.councilId ?? 'council:none', args.accessLevel].join('::')
  const localUnitId = clean(args.localUnitId)
  return localUnitId ? `${baseKey}::local-unit:${localUnitId}` : baseKey
}

export function describeAccessContext(option: {
  organizationName?: string | null
  councilName?: string | null
  councilNumber?: string | null
  accessLevel: AccessContextLevel
}) {
  const role = accessLevelLabel(option.accessLevel)
  const council = councilLabel({ name: option.councilName ?? null, council_number: option.councilNumber ?? null })
  const organization = clean(option.organizationName)

  if (council && organization) return `${role} • ${organization} • ${council}`
  if (council) return `${role} • ${council}`
  if (organization) return `${role} • ${organization}`
  return role
}

export function sortAccessContexts(contexts: AccessContextOption[]) {
  return [...contexts].sort((left, right) => {
    const levelDelta = ACCESS_LEVEL_PRIORITY[right.accessLevel] - ACCESS_LEVEL_PRIORITY[left.accessLevel]
    if (levelDelta !== 0) return levelDelta

    const orgCompare = (left.organizationName ?? '').localeCompare(right.organizationName ?? '')
    if (orgCompare !== 0) return orgCompare

    const councilCompare = (left.councilNumber ?? left.councilName ?? '').localeCompare(
      right.councilNumber ?? right.councilName ?? ''
    )
    if (councilCompare !== 0) return councilCompare

    return left.key.localeCompare(right.key)
  })
}

export function pickDefaultAccessContext(contexts: AccessContextOption[]) {
  return sortAccessContexts(contexts)[0] ?? null
}

export function buildAccessContexts(args: {
  seeds: AccessContextSeed[]
  councils: CouncilProfile[]
  organizations: OrganizationProfile[]
}) {
  const councilMap = new Map(args.councils.map((council) => [council.id, council]))
  const organizationMap = new Map(args.organizations.map((organization) => [organization.id, organization]))
  const merged = new Map<string, Omit<AccessContextOption, 'label' | 'shortLabel' | 'description'>>()

  for (const seed of args.seeds) {
    const council = seed.councilId ? councilMap.get(seed.councilId) ?? null : null
    const organizationId = seed.organizationId ?? council?.organization_id ?? null
    const organization = organizationId ? organizationMap.get(organizationId) ?? null : null
    const localUnitId = clean(seed.localUnitId)
    const key = buildAccessContextKey({
      localUnitId,
      organizationId,
      councilId: seed.councilId ?? council?.id ?? null,
      accessLevel: seed.accessLevel,
    })

    const existing = merged.get(key)
    if (existing) {
      if (!existing.sources.includes(seed.source)) existing.sources.push(seed.source)
      continue
    }

    merged.set(key, {
      key,
      localUnitId,
      organizationId,
      organizationName: organizationLabel(organization),
      councilId: seed.councilId ?? council?.id ?? null,
      councilName: clean(council?.name),
      councilNumber: clean(council?.council_number),
      accessLevel: seed.accessLevel,
      sources: [seed.source],
    })
  }

  const deduped = new Map<string, Omit<AccessContextOption, 'label' | 'shortLabel' | 'description'>>()

  for (const option of merged.values()) {
    const identityKey = option.localUnitId
      ? `local-unit:${option.localUnitId}`
      : [option.organizationId ?? 'org:none', option.councilId ?? 'council:none'].join('::')
    const existing = deduped.get(identityKey)

    if (!existing || ACCESS_LEVEL_PRIORITY[option.accessLevel] > ACCESS_LEVEL_PRIORITY[existing.accessLevel]) {
      deduped.set(identityKey, option)
      continue
    }

    if (ACCESS_LEVEL_PRIORITY[option.accessLevel] === ACCESS_LEVEL_PRIORITY[existing.accessLevel]) {
      for (const source of option.sources) {
        if (!existing.sources.includes(source)) existing.sources.push(source)
      }
    }
  }

  return sortAccessContexts(
    [...deduped.values()].map((option) => {
      const label = describeAccessContext(option)
      const shortLabel =
        option.organizationName ??
        councilLabel({ name: option.councilName, council_number: option.councilNumber }) ??
        accessLevelLabel(option.accessLevel)
      const scopeLabel = option.councilId
        ? councilLabel({ name: option.councilName, council_number: option.councilNumber })
        : option.organizationName
      return {
        ...option,
        label,
        shortLabel,
        description: scopeLabel ? `${accessLevelLabel(option.accessLevel)} access for ${scopeLabel}` : label,
      }
    })
  )
}
