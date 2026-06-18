import { canLocalUnitUseFeature } from './entitlements'
import { FEATURE_KEYS } from './keys'

export function getCustomListsPaidFeatureKey() {
  return FEATURE_KEYS.LISTS_CUSTOM
}

export async function canLocalUnitUseCustomLists(localUnitId: string | null | undefined) {
  return canLocalUnitUseFeature({
    localUnitId,
    featureKey: FEATURE_KEYS.LISTS_CUSTOM,
  })
}
