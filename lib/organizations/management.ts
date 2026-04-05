import { createAdminClient } from '@/lib/supabase/admin'

export type ManagedOrganizationTypeOption = {
  code: string
  label: string
}

export type ManagedLocalUnitKind = 'council' | 'parish' | 'conference' | 'ministry' | 'other'
export type ManagedLocalUnitVisibility = 'private' | 'public'

const DEFAULT_LOGO_BUCKET = 'organization-assets'
const COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const COUNCIL_KIND_SET = new Set<ManagedLocalUnitKind>(['council', 'parish', 'conference', 'ministry', 'other'])
const VISIBILITY_SET = new Set<ManagedLocalUnitVisibility>(['private', 'public'])

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

function normalizeColor(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return null
  return COLOR_PATTERN.test(trimmed) ? trimmed : null
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42) || 'organization'
}

function buildUniqueCode(label: string) {
  return `${slugify(label)}-${Math.random().toString(36).slice(2, 8)}`
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'logo'
}

async function uploadOrganizationLogo(args: {
  admin?: ReturnType<typeof createAdminClient>
  organizationId: string
  file: File
}) {
  const admin = args.admin ?? createAdminClient()
  const extension = sanitizeFileName(args.file.name).split('.').pop() || 'png'
  const storagePath = `organizations/${args.organizationId}/logo-${Date.now()}.${extension}`
  const fileBuffer = Buffer.from(await args.file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from(DEFAULT_LOGO_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: args.file.type || 'application/octet-stream',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data } = admin.storage.from(DEFAULT_LOGO_BUCKET).getPublicUrl(storagePath)

  return {
    storageBucket: DEFAULT_LOGO_BUCKET,
    storagePath: data.publicUrl,
  }
}

async function removeOrganizationLogoFile(args: {
  admin?: ReturnType<typeof createAdminClient>
  storagePath?: string | null
}) {
  const admin = args.admin ?? createAdminClient()
  const rawPath = normalizeText(args.storagePath)
  if (!rawPath) return

  let objectPath = rawPath

  if (/^https?:\/\//i.test(rawPath)) {
    try {
      const url = new URL(rawPath)
      const marker = `/${DEFAULT_LOGO_BUCKET}/`
      const markerIndex = url.pathname.indexOf(marker)
      if (markerIndex === -1) return
      objectPath = decodeURIComponent(url.pathname.slice(markerIndex + marker.length))
    } catch {
      return
    }
  } else if (rawPath.startsWith('/')) {
    objectPath = rawPath.replace(/^\/+/, '')
  }

  objectPath = objectPath.replace(/^public\//i, '')

  if (!objectPath.startsWith('organizations/')) return

  const { error } = await admin.storage.from(DEFAULT_LOGO_BUCKET).remove([objectPath])
  if (error) throw new Error(error.message)
}

export async function listManagedOrganizationTypeOptions(args?: {
  admin?: ReturnType<typeof createAdminClient>
}) {
  const admin = args?.admin ?? createAdminClient()
  const { data, error } = await admin
    .from('organization_type_types')
    .select('code, label, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true })

  if (error) {
    return [
      { code: 'kofc_council', label: 'Knights of Columbus' },
      { code: 'parish', label: 'Parish' },
      { code: 'ssvp_conference', label: 'Society of St. Vincent de Paul' },
      { code: 'ministry', label: 'Parish ministry' },
      { code: 'other', label: 'Other' },
    ] satisfies ManagedOrganizationTypeOption[]
  }

  return (((data as Array<{ code: string; label: string; sort_order?: number | null }> | null) ?? [])
    .map((row) => ({ code: row.code, label: row.label })))
}

export async function ensureOrganizationFamilyForOrganization(args: {
  admin?: ReturnType<typeof createAdminClient>
  organizationId: string
  organizationDisplayName: string
  actorUserId: string
}) {
  const admin = args.admin ?? createAdminClient()

  const { data: existingFamily, error: familyLookupError } = await admin
    .from('organization_families')
    .select('id')
    .eq('legacy_organization_id', args.organizationId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>()

  if (familyLookupError) {
    throw new Error(familyLookupError.message)
  }

  if (existingFamily?.id) return existingFamily.id

  const { data: createdFamily, error: familyInsertError } = await admin
    .from('organization_families')
    .insert({
      code: buildUniqueCode(args.organizationDisplayName),
      display_name: args.organizationDisplayName,
      terminology_json: {},
      active: true,
      legacy_organization_id: args.organizationId,
      created_by_auth_user_id: args.actorUserId,
      updated_by_auth_user_id: args.actorUserId,
    })
    .select('id')
    .maybeSingle<{ id: string }>()

  if (familyInsertError || !createdFamily?.id) {
    throw new Error(familyInsertError?.message || 'Could not create the organization family record.')
  }

  return createdFamily.id
}

export async function createManagedOrganization(args: {
  actorUserId: string
  displayName: string
  preferredName?: string | null
  organizationTypeCode: string
  primaryColorHex?: string | null
  secondaryColorHex?: string | null
  logoAltText?: string | null
  logoFile?: File | null
  firstLocalUnitKind: ManagedLocalUnitKind
  firstLocalUnitDisplayName: string
  firstLocalUnitOfficialName?: string | null
  firstLocalUnitVisibility?: ManagedLocalUnitVisibility
  firstCouncilNumber?: string | null
  firstCouncilTimezone?: string | null
}) {
  const admin = createAdminClient()
  const displayName = normalizeText(args.displayName)
  const preferredName = normalizeText(args.preferredName)
  const organizationTypeCode = normalizeText(args.organizationTypeCode)
  const firstLocalUnitDisplayName = normalizeText(args.firstLocalUnitDisplayName)
  const firstLocalUnitOfficialName = normalizeText(args.firstLocalUnitOfficialName) ?? firstLocalUnitDisplayName
  const firstCouncilNumber = normalizeText(args.firstCouncilNumber)
  const firstCouncilTimezone = normalizeText(args.firstCouncilTimezone) ?? 'America/Toronto'
  const firstLocalUnitVisibility = VISIBILITY_SET.has(args.firstLocalUnitVisibility ?? 'private')
    ? (args.firstLocalUnitVisibility ?? 'private')
    : 'private'
  const firstLocalUnitKind = COUNCIL_KIND_SET.has(args.firstLocalUnitKind) ? args.firstLocalUnitKind : 'other'

  if (!displayName) throw new Error('Please enter the organization name.')
  if (!organizationTypeCode) throw new Error('Choose an organization type before saving.')
  if (!firstLocalUnitDisplayName) throw new Error('Please enter the first local unit name.')
  if (firstLocalUnitKind === 'council' && !firstCouncilNumber) {
    throw new Error('Council number is required when the first local unit is a council.')
  }

  const organizationId = crypto.randomUUID()
  const brandProfileId = crypto.randomUUID()

  let createdCouncilId: string | null = null
  let createdOrganizationId: string | null = null
  let createdBrandProfileId: string | null = null

  try {
    let logoStoragePath: string | null = null
    let logoStorageBucket = DEFAULT_LOGO_BUCKET

    if (args.logoFile && args.logoFile.size > 0) {
      const upload = await uploadOrganizationLogo({
        admin,
        organizationId,
        file: args.logoFile,
      })
      logoStoragePath = upload.storagePath
      logoStorageBucket = upload.storageBucket
    }

    const { error: brandProfileError } = await admin
      .from('brand_profiles')
      .insert({
        id: brandProfileId,
        code: buildUniqueCode(preferredName ?? displayName),
        display_name: preferredName ?? displayName,
        logo_storage_bucket: logoStorageBucket,
        logo_storage_path: logoStoragePath,
        logo_alt_text: normalizeText(args.logoAltText),
        created_by_auth_user_id: args.actorUserId,
        updated_by_auth_user_id: args.actorUserId,
      })

    if (brandProfileError) throw new Error(brandProfileError.message)
    createdBrandProfileId = brandProfileId

    const { error: organizationError } = await admin
      .from('organizations')
      .insert({
        id: organizationId,
        display_name: displayName,
        preferred_name: preferredName,
        organization_type_code: organizationTypeCode,
        primary_color_hex: normalizeColor(args.primaryColorHex),
        secondary_color_hex: normalizeColor(args.secondaryColorHex),
        brand_profile_id: brandProfileId,
        logo_storage_bucket: logoStorageBucket,
        logo_storage_path: logoStoragePath,
        logo_alt_text: normalizeText(args.logoAltText),
        created_by_auth_user_id: args.actorUserId,
        updated_by_auth_user_id: args.actorUserId,
      })

    if (organizationError) throw new Error(organizationError.message)
    createdOrganizationId = organizationId

    const organizationFamilyId = await ensureOrganizationFamilyForOrganization({
      admin,
      organizationId,
      organizationDisplayName: preferredName ?? displayName,
      actorUserId: args.actorUserId,
    })

    if (firstLocalUnitKind === 'council') {
      const { data: councilRow, error: councilError } = await admin
        .from('councils')
        .insert({
          council_number: firstCouncilNumber,
          name: firstLocalUnitDisplayName,
          timezone: firstCouncilTimezone,
          organization_id: organizationId,
        })
        .select('id')
        .maybeSingle<{ id: string }>()

      if (councilError || !councilRow?.id) {
        throw new Error(councilError?.message || 'Could not create the legacy council shell.')
      }

      createdCouncilId = councilRow.id
    }

    const { data: localUnitRow, error: localUnitError } = await admin
      .from('local_units')
      .insert({
        organization_family_id: organizationFamilyId,
        official_name: firstLocalUnitOfficialName,
        display_name: firstLocalUnitDisplayName,
        local_unit_kind: firstLocalUnitKind,
        status: 'active',
        visibility: firstLocalUnitVisibility,
        legacy_council_id: createdCouncilId,
        legacy_organization_id: organizationId,
        created_by_auth_user_id: args.actorUserId,
        updated_by_auth_user_id: args.actorUserId,
      })
      .select('id')
      .maybeSingle<{ id: string }>()

    if (localUnitError || !localUnitRow?.id) {
      throw new Error(localUnitError?.message || 'Could not create the local unit.')
    }

    return {
      organizationId,
      localUnitId: localUnitRow.id,
      councilId: createdCouncilId,
      organizationName: preferredName ?? displayName,
    }
  } catch (error) {
    if (createdCouncilId) {
      await admin.from('councils').delete().eq('id', createdCouncilId)
    }
    if (createdOrganizationId) {
      await admin.from('organizations').delete().eq('id', createdOrganizationId)
    }
    if (createdBrandProfileId) {
      await admin.from('brand_profiles').delete().eq('id', createdBrandProfileId)
    }
    throw error
  }
}

export async function updateManagedOrganization(args: {
  actorUserId: string
  organizationId: string
  displayName: string
  preferredName?: string | null
  organizationTypeCode: string
  primaryColorHex?: string | null
  secondaryColorHex?: string | null
  logoAltText?: string | null
  logoFile?: File | null
}) {
  const admin = createAdminClient()
  const displayName = normalizeText(args.displayName)
  const preferredName = normalizeText(args.preferredName)
  const organizationTypeCode = normalizeText(args.organizationTypeCode)
  if (!displayName) throw new Error('Please enter the organization name.')
  if (!organizationTypeCode) throw new Error('Choose an organization type before saving.')

  const { data: existingOrganization, error: orgLookupError } = await admin
    .from('organizations')
    .select('brand_profile_id, logo_storage_bucket, logo_storage_path')
    .eq('id', args.organizationId)
    .maybeSingle<{ brand_profile_id: string; logo_storage_bucket: string | null; logo_storage_path: string | null }>()

  if (orgLookupError || !existingOrganization?.brand_profile_id) {
    throw new Error(orgLookupError?.message || 'Could not load the organization you are trying to update.')
  }

  let logoStoragePath = existingOrganization.logo_storage_path ?? null
  let logoStorageBucket = existingOrganization.logo_storage_bucket ?? DEFAULT_LOGO_BUCKET

  if (args.logoFile && args.logoFile.size > 0) {
    const upload = await uploadOrganizationLogo({
      admin,
      organizationId: args.organizationId,
      file: args.logoFile,
    })
    logoStoragePath = upload.storagePath
    logoStorageBucket = upload.storageBucket
  }

  const updatePayload = {
    display_name: displayName,
    preferred_name: preferredName,
    organization_type_code: organizationTypeCode,
    primary_color_hex: normalizeColor(args.primaryColorHex),
    secondary_color_hex: normalizeColor(args.secondaryColorHex),
    logo_storage_bucket: logoStorageBucket,
    logo_storage_path: logoStoragePath,
    logo_alt_text: normalizeText(args.logoAltText),
    updated_by_auth_user_id: args.actorUserId,
  }

  const [{ error: orgUpdateError }, { error: brandUpdateError }] = await Promise.all([
    admin.from('organizations').update(updatePayload).eq('id', args.organizationId),
    admin
      .from('brand_profiles')
      .update({
        display_name: preferredName ?? displayName,
        updated_by_auth_user_id: args.actorUserId,
      })
      .eq('id', existingOrganization.brand_profile_id),
  ])

  if (orgUpdateError) throw new Error(orgUpdateError.message)
  if (brandUpdateError) throw new Error(brandUpdateError.message)
}

export async function removeManagedOrganizationLogo(args: {
  actorUserId: string
  organizationId: string
}) {
  const admin = createAdminClient()

  const { data: existingOrganization, error: orgLookupError } = await admin
    .from('organizations')
    .select('logo_storage_bucket, logo_storage_path')
    .eq('id', args.organizationId)
    .maybeSingle<{ logo_storage_bucket: string | null; logo_storage_path: string | null }>()

  if (orgLookupError) {
    throw new Error(orgLookupError.message)
  }

  if (!existingOrganization) {
    throw new Error('Could not load the organization you are trying to update.')
  }

  await removeOrganizationLogoFile({
    admin,
    storagePath: existingOrganization.logo_storage_path,
  })

  const currentBucket = existingOrganization.logo_storage_bucket ?? DEFAULT_LOGO_BUCKET

  const { error: orgUpdateError } = await admin
    .from('organizations')
    .update({
      logo_storage_bucket: currentBucket,
      logo_storage_path: null,
      logo_alt_text: null,
      updated_by_auth_user_id: args.actorUserId,
    })
    .eq('id', args.organizationId)

  if (orgUpdateError) throw new Error(orgUpdateError.message)
}

export async function createManagedLocalUnit(args: {
  actorUserId: string
  organizationId: string
  organizationDisplayName: string
  localUnitKind: ManagedLocalUnitKind
  displayName: string
  officialName?: string | null
  visibility?: ManagedLocalUnitVisibility
  councilNumber?: string | null
  timezone?: string | null
}) {
  const admin = createAdminClient()
  const displayName = normalizeText(args.displayName)
  const officialName = normalizeText(args.officialName) ?? displayName
  const localUnitKind = COUNCIL_KIND_SET.has(args.localUnitKind) ? args.localUnitKind : 'other'
  const visibility = VISIBILITY_SET.has(args.visibility ?? 'private') ? (args.visibility ?? 'private') : 'private'
  const councilNumber = normalizeText(args.councilNumber)
  const timezone = normalizeText(args.timezone) ?? 'America/Toronto'

  if (!displayName) throw new Error('Please enter the local unit name.')
  if (localUnitKind === 'council' && !councilNumber) {
    throw new Error('Council number is required when the local unit kind is council.')
  }

  const organizationFamilyId = await ensureOrganizationFamilyForOrganization({
    admin,
    organizationId: args.organizationId,
    organizationDisplayName: args.organizationDisplayName,
    actorUserId: args.actorUserId,
  })

  let createdCouncilId: string | null = null

  try {
    if (localUnitKind === 'council') {
      const { data: councilRow, error: councilError } = await admin
        .from('councils')
        .insert({
          organization_id: args.organizationId,
          council_number: councilNumber,
          name: displayName,
          timezone,
        })
        .select('id')
        .maybeSingle<{ id: string }>()

      if (councilError || !councilRow?.id) {
        throw new Error(councilError?.message || 'Could not create the council shell for this local unit.')
      }

      createdCouncilId = councilRow.id
    }

    const { data: localUnitRow, error: localUnitError } = await admin
      .from('local_units')
      .insert({
        organization_family_id: organizationFamilyId,
        official_name: officialName,
        display_name: displayName,
        local_unit_kind: localUnitKind,
        status: 'active',
        visibility,
        legacy_organization_id: args.organizationId,
        legacy_council_id: createdCouncilId,
        created_by_auth_user_id: args.actorUserId,
        updated_by_auth_user_id: args.actorUserId,
      })
      .select('id')
      .maybeSingle<{ id: string }>()

    if (localUnitError || !localUnitRow?.id) {
      throw new Error(localUnitError?.message || 'Could not create the local unit.')
    }

    return {
      localUnitId: localUnitRow.id,
      councilId: createdCouncilId,
    }
  } catch (error) {
    if (createdCouncilId) {
      await admin.from('councils').delete().eq('id', createdCouncilId)
    }
    throw error
  }
}

export function getManagedLocalUnitKindOptions() {
  return [
    { value: 'council', label: 'Council' },
    { value: 'parish', label: 'Parish' },
    { value: 'conference', label: 'Conference' },
    { value: 'ministry', label: 'Ministry' },
    { value: 'other', label: 'Other' },
  ] as const
}

export function getManagedVisibilityOptions() {
  return [
    { value: 'private', label: 'Private' },
    { value: 'public', label: 'Public' },
  ] as const
}