import type { ManagedAreaAccessLevel, ManagedAreaCode } from '@/lib/auth/area-access'

function readBooleanFlag(value: string | undefined, defaultValue = false) {
  if (typeof value !== 'string') return defaultValue
  return value === 'true'
}

function readAreaSpecificFlag(areaCode: ManagedAreaCode) {
  switch (areaCode) {
    case 'members':
      return process.env.CHRISM_USE_PARALLEL_AREA_ACCESS_MEMBERS
    case 'events':
      return process.env.CHRISM_USE_PARALLEL_AREA_ACCESS_EVENTS
    case 'custom_lists':
      return process.env.CHRISM_USE_PARALLEL_AREA_ACCESS_CUSTOM_LISTS
    case 'claims':
      return process.env.CHRISM_USE_PARALLEL_AREA_ACCESS_CLAIMS
    case 'admins':
      return process.env.CHRISM_USE_PARALLEL_AREA_ACCESS_ADMINS
    case 'local_unit_settings':
      return process.env.CHRISM_USE_PARALLEL_AREA_ACCESS_LOCAL_UNIT_SETTINGS
    default:
      return undefined
  }
}

export function isParallelAreaAccessEnabled(args: {
  areaCode: ManagedAreaCode
  minimumAccessLevel: ManagedAreaAccessLevel
}) {
  const areaSpecificFlag = readAreaSpecificFlag(args.areaCode)
  if (typeof areaSpecificFlag === 'string') {
    return readBooleanFlag(areaSpecificFlag)
  }

  if (typeof process.env.CHRISM_USE_PARALLEL_AREA_ACCESS === 'string') {
    return readBooleanFlag(process.env.CHRISM_USE_PARALLEL_AREA_ACCESS)
  }

  return true
}

export function useParallelAreaAccessForMembers() {
  return isParallelAreaAccessEnabled({ areaCode: 'members', minimumAccessLevel: 'edit_manage' })
}

export function useParallelAreaAccessForEvents() {
  return isParallelAreaAccessEnabled({ areaCode: 'events', minimumAccessLevel: 'manage' })
}

export function useParallelAreaAccessForCustomLists() {
  return isParallelAreaAccessEnabled({ areaCode: 'custom_lists', minimumAccessLevel: 'interact' })
}

export function useParallelAreaAccessForLocalUnitSettings() {
  return isParallelAreaAccessEnabled({ areaCode: 'local_unit_settings', minimumAccessLevel: 'manage' })
}
