import type { OfficerScopeCode, OfficerTermRow } from '@/lib/members/officer-roles'

export const LOCAL_UNIT_OFFICER_TERM_SELECT = [
  'id',
  'person_id',
  'office_scope_code',
  'office_code',
  'office_label',
  'office_rank',
  'service_start_year',
  'service_end_year',
  'manual_end_effective_date',
  'notes',
].join(', ')

export const LOCAL_UNIT_OFFICER_ROLE_EMAIL_SELECT = [
  'id',
  'local_unit_id',
  'office_scope_code',
  'office_code',
  'office_rank',
  'email',
].join(', ')

export type LocalUnitOfficerTermRow = OfficerTermRow & {
  id: string
  person_id: string
}

export type LocalUnitOfficerRoleEmailRow = {
  id: string
  local_unit_id: string | null
  office_scope_code: OfficerScopeCode
  office_code: string
  office_rank: number | null
  email: string
}

export function officerRoleEmailKey(args: {
  office_scope_code: string
  office_code: string
  office_rank?: number | null
}) {
  return `${args.office_scope_code}:${args.office_code}:${args.office_rank ?? 'none'}`
}
