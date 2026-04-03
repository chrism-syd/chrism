export const SUPER_ADMIN_EMAIL = 'sydsaddress@gmail.com'

export const ACTING_MODE_COOKIE = 'chrism_acting_mode'
export const ACTING_ORGANIZATION_COOKIE = 'chrism_acting_organization_id'
export const ACTING_COUNCIL_COOKIE = 'chrism_acting_council_id'
export const ACTIVE_ACCESS_CONTEXT_COOKIE = 'chrism_active_access_context'

export const ACTING_MODE_COOKIE_NAME = ACTING_MODE_COOKIE
export const ACTING_ORGANIZATION_COOKIE_NAME = ACTING_ORGANIZATION_COOKIE
export const ACTING_COUNCIL_COOKIE_NAME = ACTING_COUNCIL_COOKIE
export const ACTIVE_ACCESS_CONTEXT_COOKIE_NAME = ACTIVE_ACCESS_CONTEXT_COOKIE

export type ActingMode = 'normal' | 'admin' | 'member'

export function normalizeActingMode(value: string | null | undefined): ActingMode {
  if (value === 'admin' || value === 'member' || value === 'normal') return value
  return 'normal'
}

export function isConfiguredSuperAdminEmail(email?: string | null) {
  return (email ?? '').trim().toLowerCase() === SUPER_ADMIN_EMAIL
}

export function getSuperAdminViewLabel(args: {
  mode: ActingMode
  organizationName?: string | null
}) {
  const { mode, organizationName } = args
  if (mode === 'normal') return 'My normal access'
  const orgLabel = organizationName?.trim() || 'Organization'
  return `${mode === 'admin' ? 'Admin' : 'Member'} • ${orgLabel}`
}
