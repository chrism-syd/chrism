'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function numberValue(formData: FormData, key: string) {
  const value = textValue(formData, key)
  if (!value) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

function redirectToAnnualTermManager(args: { error?: string | null; notice?: string | null }): never {
  const params = new URLSearchParams()
  if (args.error) params.set('error', args.error)
  if (args.notice) params.set('notice', args.notice)
  redirect(params.size > 0 ? `/super-admin/organizations/annual-term?${params.toString()}` : '/super-admin/organizations/annual-term')
}

async function requireSuperAdminNormalMode() {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser || !permissions.isSuperAdmin || permissions.actingMode !== 'normal') {
    redirect('/me')
  }
  return permissions
}

function isValidMonthDay(month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const candidate = new Date(Date.UTC(2024, month - 1, day, 12, 0, 0))
  return candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day
}

export async function updateParentOrganizationAnnualTermAction(formData: FormData) {
  const permissions = await requireSuperAdminNormalMode()
  const organizationId = textValue(formData, 'organization_id')

  if (!organizationId) {
    redirectToAnnualTermManager({ error: 'We could not tell which parent organization to update.' })
  }

  const rawMode = textValue(formData, 'annual_term_mode') ?? 'calendar'
  const mode = rawMode === 'custom' ? 'custom' : 'calendar'
  const label = mode === 'calendar'
    ? 'Calendar Year'
    : textValue(formData, 'annual_term_label') ?? 'Annual Term'
  const startMonth = mode === 'calendar' ? 1 : numberValue(formData, 'annual_term_start_month')
  const startDay = mode === 'calendar' ? 1 : numberValue(formData, 'annual_term_start_day')

  if (!startMonth || !startDay || !isValidMonthDay(startMonth, startDay)) {
    redirectToAnnualTermManager({ error: 'Choose a valid annual term start month and day.' })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('organizations')
    .update({
      annual_term_mode: mode,
      annual_term_label: label,
      annual_term_start_month: startMonth,
      annual_term_start_day: startDay,
      updated_by_auth_user_id: permissions.authUser!.id,
    })
    .eq('id', organizationId)

  if (error) {
    redirectToAnnualTermManager({ error: error.message })
  }

  revalidatePath('/super-admin/organizations')
  revalidatePath('/super-admin/organizations/annual-term')
  revalidatePath('/me/council')
  revalidatePath('/people/officers')
  revalidatePath('/events/volunteer-hours')

  redirectToAnnualTermManager({ notice: 'Parent organization annual term saved.' })
}
