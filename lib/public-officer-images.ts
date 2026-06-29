import type { OfficerScopeCode } from '@/lib/members/officer-roles'

export type PublicOfficerImageMode = 'show_image' | 'none'

const KofcOrganizationTypeCodes = new Set(['knights_of_columbus', 'kofc'])

const KofcOfficerMedalByOfficeCode: Record<string, string> = {
  grand_knight: '/kofc/officer-medals/grand_knight.png',
  deputy_grand_knight: '/kofc/officer-medals/deputy_grand_knight.png',
  chancellor: '/kofc/officer-medals/chancellor.png',
  recorder: '/kofc/officer-medals/recorder.png',
  treasurer: '/kofc/officer-medals/treasurer.png',
  advocate: '/kofc/officer-medals/advocate.png',
  warden: '/kofc/officer-medals/warden.png',
  inside_guard: '/kofc/officer-medals/inside_guard.png',
  outside_guard: '/kofc/officer-medals/outside_guard.png',
  trustee: '/kofc/officer-medals/trustee.png',
  chaplain: '/kofc/officer-medals/chaplain.png',
  financial_secretary: '/kofc/officer-medals/financial_secretary.png',
  lecturer: '/kofc/officer-medals/lecturer.png',
}

function normalizeLookupCode(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function normalizePublicOfficerImageMode(value: string | null | undefined): PublicOfficerImageMode {
  return value === 'none' ? 'none' : 'show_image'
}

export function isKnightsOfColumbusOrganizationType(organizationTypeCode: string | null | undefined) {
  const normalizedCode = normalizeLookupCode(organizationTypeCode)
  return !normalizedCode || KofcOrganizationTypeCodes.has(normalizedCode)
}

export function getKofcOfficerMedalSrc(args: {
  organizationTypeCode?: string | null | undefined
  useKofcOfficerMedals?: boolean
  officeScopeCode: OfficerScopeCode | string
  officeCode: string
}) {
  if (normalizeLookupCode(args.officeScopeCode) !== 'council') return null

  return KofcOfficerMedalByOfficeCode[normalizeLookupCode(args.officeCode)] ?? null
}

export function resolvePublicOfficerImageSrc(args: {
  imageMode: PublicOfficerImageMode | string | null | undefined
  uploadedPortraitUrl: string | null
  organizationTypeCode?: string | null | undefined
  useKofcOfficerMedals?: boolean
  officeScopeCode: OfficerScopeCode | string
  officeCode: string
}) {
  const imageMode = normalizePublicOfficerImageMode(args.imageMode)
  if (imageMode === 'none') return null

  return args.uploadedPortraitUrl ?? getKofcOfficerMedalSrc(args)
}
