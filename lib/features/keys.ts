export const FEATURE_KEYS = {
  AUTOMATION_EMAIL_FOLLOWUPS: 'automation.email_followups',
  AUTOMATION_EVENT_REMINDERS: 'automation.event_reminders',
  AUTOMATION_RSVP_NUDGES: 'automation.rsvp_nudges',
  AUTOMATION_VOLUNTEER_REMINDERS: 'automation.volunteer_reminders',
  AUTOMATION_SCHEDULED_CAMPAIGNS: 'automation.scheduled_campaigns',
  LISTS_CUSTOM: 'lists.custom',
  DOMAINS_CUSTOM: 'domains.custom',
  BRANDING_WHITE_LABEL: 'branding.white_label',
  REPORTS_ADVANCED: 'reports.advanced',
} as const

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS]

export const PAID_FEATURE_KEYS = [
  FEATURE_KEYS.AUTOMATION_EMAIL_FOLLOWUPS,
  FEATURE_KEYS.AUTOMATION_EVENT_REMINDERS,
  FEATURE_KEYS.AUTOMATION_RSVP_NUDGES,
  FEATURE_KEYS.AUTOMATION_VOLUNTEER_REMINDERS,
  FEATURE_KEYS.AUTOMATION_SCHEDULED_CAMPAIGNS,
  FEATURE_KEYS.LISTS_CUSTOM,
  FEATURE_KEYS.DOMAINS_CUSTOM,
  FEATURE_KEYS.BRANDING_WHITE_LABEL,
  FEATURE_KEYS.REPORTS_ADVANCED,
] as const satisfies readonly FeatureKey[]

export function isPaidFeatureKey(featureKey: FeatureKey) {
  return PAID_FEATURE_KEYS.includes(featureKey)
}
