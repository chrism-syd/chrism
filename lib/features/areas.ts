import type { ManagedAreaCode } from '@/lib/auth/area-access'
import type { FeatureKey } from './keys'
import { FEATURE_KEYS } from './keys'

export function getFeatureKeyForManagedArea(areaCode: ManagedAreaCode): FeatureKey | null {
  switch (areaCode) {
    case 'members':
      return FEATURE_KEYS.MEMBERS_DIRECTORY
    case 'claims':
      return FEATURE_KEYS.CLAIMS_MANAGEMENT
    case 'admins':
      return FEATURE_KEYS.ADMINS_MANAGEMENT
    case 'local_unit_settings':
      return FEATURE_KEYS.LOCAL_UNIT_SETTINGS
    case 'custom_lists':
      return FEATURE_KEYS.LISTS_CUSTOM
    case 'events':
      return null
    default:
      return null
  }
}
