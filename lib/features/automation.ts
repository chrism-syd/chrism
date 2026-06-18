import { canLocalUnitUseFeature } from './entitlements'
import type { FeatureKey } from './keys'
import { FEATURE_KEYS } from './keys'

export type AutomationFeatureKey =
  | typeof FEATURE_KEYS.AUTOMATION_EMAIL_FOLLOWUPS
  | typeof FEATURE_KEYS.AUTOMATION_EVENT_REMINDERS
  | typeof FEATURE_KEYS.AUTOMATION_RSVP_NUDGES
  | typeof FEATURE_KEYS.AUTOMATION_VOLUNTEER_REMINDERS
  | typeof FEATURE_KEYS.AUTOMATION_SCHEDULED_CAMPAIGNS

export const AUTOMATION_FEATURE_KEYS = {
  EMAIL_FOLLOWUPS: FEATURE_KEYS.AUTOMATION_EMAIL_FOLLOWUPS,
  EVENT_REMINDERS: FEATURE_KEYS.AUTOMATION_EVENT_REMINDERS,
  RSVP_NUDGES: FEATURE_KEYS.AUTOMATION_RSVP_NUDGES,
  VOLUNTEER_REMINDERS: FEATURE_KEYS.AUTOMATION_VOLUNTEER_REMINDERS,
  SCHEDULED_CAMPAIGNS: FEATURE_KEYS.AUTOMATION_SCHEDULED_CAMPAIGNS,
} as const

export function isAutomationFeatureKey(featureKey: FeatureKey): featureKey is AutomationFeatureKey {
  return Object.values(AUTOMATION_FEATURE_KEYS).includes(featureKey as AutomationFeatureKey)
}

export async function canLocalUnitUseAutomationFeature(args: {
  localUnitId: string | null | undefined
  featureKey: AutomationFeatureKey
}) {
  return canLocalUnitUseFeature({
    localUnitId: args.localUnitId,
    featureKey: args.featureKey,
  })
}

export async function canLocalUnitUseEmailFollowups(localUnitId: string | null | undefined) {
  return canLocalUnitUseAutomationFeature({
    localUnitId,
    featureKey: FEATURE_KEYS.AUTOMATION_EMAIL_FOLLOWUPS,
  })
}

export async function canLocalUnitUseEventReminders(localUnitId: string | null | undefined) {
  return canLocalUnitUseAutomationFeature({
    localUnitId,
    featureKey: FEATURE_KEYS.AUTOMATION_EVENT_REMINDERS,
  })
}

export async function canLocalUnitUseRsvpNudges(localUnitId: string | null | undefined) {
  return canLocalUnitUseAutomationFeature({
    localUnitId,
    featureKey: FEATURE_KEYS.AUTOMATION_RSVP_NUDGES,
  })
}

export async function canLocalUnitUseVolunteerReminders(localUnitId: string | null | undefined) {
  return canLocalUnitUseAutomationFeature({
    localUnitId,
    featureKey: FEATURE_KEYS.AUTOMATION_VOLUNTEER_REMINDERS,
  })
}

export async function canLocalUnitUseScheduledCampaigns(localUnitId: string | null | undefined) {
  return canLocalUnitUseAutomationFeature({
    localUnitId,
    featureKey: FEATURE_KEYS.AUTOMATION_SCHEDULED_CAMPAIGNS,
  })
}
