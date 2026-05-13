import type { ManagedAreaAccessLevel, ManagedAreaCode } from '@/lib/auth/area-access'

export const ORG_ADMIN_AREA_ACCESS_LEVEL = 'manage' satisfies ManagedAreaAccessLevel

export const ORG_ADMIN_MANAGED_AREA_CODES = [
  'members',
  'events',
  'custom_lists',
  'admins',
  'local_unit_settings',
] as const satisfies ManagedAreaCode[]

export const ORG_ADMIN_EXCLUDED_AREA_CODES = [
  'claims',
] as const satisfies ManagedAreaCode[]

export type OrgAdminManagedAreaCode = (typeof ORG_ADMIN_MANAGED_AREA_CODES)[number]
export type OrgAdminExcludedAreaCode = (typeof ORG_ADMIN_EXCLUDED_AREA_CODES)[number]

const ORG_ADMIN_MANAGED_AREA_CODE_SET = new Set<ManagedAreaCode>(ORG_ADMIN_MANAGED_AREA_CODES)

export function isOrgAdminManagedAreaCode(areaCode: ManagedAreaCode) {
  return ORG_ADMIN_MANAGED_AREA_CODE_SET.has(areaCode)
}

export function getOrgAdminAreaAccessLevel(areaCode: ManagedAreaCode): ManagedAreaAccessLevel | null {
  return isOrgAdminManagedAreaCode(areaCode) ? ORG_ADMIN_AREA_ACCESS_LEVEL : null
}

export function listOrgAdminAreaAccessRows(args: {
  localUnitId: string
  localUnitName: string
}) {
  return ORG_ADMIN_MANAGED_AREA_CODES.map((areaCode) => ({
    local_unit_id: args.localUnitId,
    local_unit_name: args.localUnitName,
    area_code: areaCode,
    access_level: ORG_ADMIN_AREA_ACCESS_LEVEL,
  }))
}
