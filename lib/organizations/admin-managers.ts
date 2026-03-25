import type { CurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'

const MANUAL_ADMIN_MANAGER_OFFICE_CODES = new Set(['grand_knight', 'financial_secretary'])

type OfficerTermRoleRow = {
  office_code: string
  office_label: string
}

export async function getOrganizationAdminManagerAccess(args: {
  permissions: CurrentUserPermissions
  councilId: string | null
}) {
  if (args.permissions.isSuperAdmin) {
    return {
      canManageAdmins: true,
      roleLabels: ['Super admin'],
    }
  }

  if (!args.permissions.personId || !args.councilId) {
    return {
      canManageAdmins: false,
      roleLabels: [] as string[],
    }
  }

  const admin = createAdminClient()
  const currentYear = new Date().getFullYear()
  const { data } = await admin
    .from('person_officer_terms')
    .select('office_code, office_label')
    .eq('person_id', args.permissions.personId)
    .eq('council_id', args.councilId)
    .eq('office_scope_code', 'council')
    .lte('service_start_year', currentYear)
    .or(`service_end_year.is.null,service_end_year.gte.${currentYear}`)

  const terms = ((data as OfficerTermRoleRow[] | null) ?? []).filter((term) =>
    MANUAL_ADMIN_MANAGER_OFFICE_CODES.has(term.office_code)
  )

  return {
    canManageAdmins: terms.length > 0,
    roleLabels: terms.map((term) => term.office_label),
  }
}
