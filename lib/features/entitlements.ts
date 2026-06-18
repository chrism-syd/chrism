import type { FeatureKey } from './keys'
import { isPaidFeatureKey } from './keys'

export type LocalUnitFeatureAccessReason = 'baseline' | 'scaffold_allow' | 'missing_local_unit'

export type LocalUnitFeatureAccessResult = {
  allowed: boolean
  featureKey: FeatureKey
  localUnitId: string | null
  reason: LocalUnitFeatureAccessReason
  requiresPaidPlan: boolean
}

type LocalUnitFeatureAccessInput = {
  localUnitId: string | null | undefined
  featureKey: FeatureKey
}

export async function canLocalUnitUseFeature(args: LocalUnitFeatureAccessInput): Promise<LocalUnitFeatureAccessResult> {
  const localUnitId = args.localUnitId?.trim() || null
  const requiresPaidPlan = isPaidFeatureKey(args.featureKey)

  if (!localUnitId) {
    return {
      allowed: false,
      featureKey: args.featureKey,
      localUnitId: null,
      reason: 'missing_local_unit',
      requiresPaidPlan,
    }
  }

  return {
    allowed: true,
    featureKey: args.featureKey,
    localUnitId,
    reason: requiresPaidPlan ? 'scaffold_allow' : 'baseline',
    requiresPaidPlan,
  }
}

export async function canUserAccessFeature(args: LocalUnitFeatureAccessInput & { userId: string | null | undefined }) {
  if (!args.userId) {
    return {
      allowed: false,
      featureKey: args.featureKey,
      localUnitId: args.localUnitId?.trim() || null,
      reason: 'missing_local_unit' as const,
      requiresPaidPlan: isPaidFeatureKey(args.featureKey),
    }
  }

  return canLocalUnitUseFeature(args)
}
