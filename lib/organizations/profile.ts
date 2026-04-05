import { createAdminClient } from '@/lib/supabase/admin'

export type OrganizationProfileRow = {
  id?: string | null
  display_name: string | null
  preferred_name: string | null
  logo_storage_path: string | null
  logo_alt_text: string | null
  org_type_code?: string | null
  brand_profile?: {
    code: string | null
    display_name: string | null
    logo_storage_bucket: string | null
    logo_storage_path: string | null
    logo_alt_text: string | null
  } | null
}

type LocalUnitContextRow = {
  id: string
  display_name: string | null
  legacy_organization_id: string | null
  legacy_council_id: string | null
}

type CouncilContextRow = {
  id: string
  name: string | null
  council_number: string | null
  organization_id: string | null
}

export async function loadOrganizationProfileForContext(args: {
  admin: ReturnType<typeof createAdminClient>
  localUnitId?: string | null
  organizationId?: string | null
  councilId?: string | null
}) {
  const { admin } = args

  const localUnit = args.localUnitId
    ? (((
        await admin
          .from('local_units')
          .select('id, display_name, legacy_organization_id, legacy_council_id')
          .eq('id', args.localUnitId)
          .maybeSingle<LocalUnitContextRow>()
      ).data as LocalUnitContextRow | null) ?? null)
    : null

  const resolvedCouncilId = localUnit?.legacy_council_id ?? args.councilId ?? null

  const council = resolvedCouncilId
    ? (((
        await admin
          .from('councils')
          .select('id, name, council_number, organization_id')
          .eq('id', resolvedCouncilId)
          .maybeSingle<CouncilContextRow>()
      ).data as CouncilContextRow | null) ?? null)
    : null

  const resolvedOrganizationId = args.organizationId ?? council?.organization_id ?? localUnit?.legacy_organization_id ?? null

  const organization = resolvedOrganizationId
    ? (((
        await admin
          .from('organizations')
          .select(
            'id, display_name, preferred_name, logo_storage_path, logo_alt_text, org_type_code, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)'
          )
          .eq('id', resolvedOrganizationId)
          .maybeSingle<OrganizationProfileRow>()
      ).data as OrganizationProfileRow | null) ?? null)
    : null

  return {
    localUnit,
    council,
    organization,
  }
}
