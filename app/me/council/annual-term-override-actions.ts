'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
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

function isValidMonthDay(month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const candidate = new Date(Date.UTC(2024, month - 1, day, 12, 0, 0))
  return candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day
}

export async function saveLocalAnnualTermOverrideAction(formData: FormData) {
  const context = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/me',
    areaCode: 'local_unit_settings',
    minimumAccessLevel: 'manage',
  })

  if (!context.localUnitId || !context.permissions.canAccessOrganizationSettings) {
    redirect('/me')
  }

  const mode = textValue(formData, 'local_annual_term_mode') === 'custom' ? 'custom' : 'inherit'
  const admin = createAdminClient()

  if (mode === 'inherit') {
    const { data: organization, error: organizationError } = await admin
      .from('organizations')
      .select('annual_term_label, annual_term_start_month, annual_term_start_day')
      .eq('id', context.permissions.organizationId!)
      .maybeSingle<{
        annual_term_label: string | null
        annual_term_start_month: number | null
        annual_term_start_day: number | null
      }>()

    if (organizationError) {
      throw new Error(organizationError.message)
    }

    const { error } = await admin
      .from('local_unit_reporting_year_settings')
      .upsert({
        local_unit_id: context.localUnitId,
        year_label: organization?.annual_term_label?.trim() || 'Calendar Year',
        year_start_month: organization?.annual_term_start_month ?? 1,
        year_start_day: organization?.annual_term_start_day ?? 1,
        is_local_override: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'local_unit_id' })

    if (error) throw new Error(error.message)
  } else {
    const label = textValue(formData, 'local_annual_term_label') ?? 'Annual Term'
    const startMonth = numberValue(formData, 'local_annual_term_start_month')
    const startDay = numberValue(formData, 'local_annual_term_start_day')

    if (!startMonth || !startDay || !isValidMonthDay(startMonth, startDay)) {
      throw new Error('Choose a valid local annual term start month and day.')
    }

    const { error } = await admin
      .from('local_unit_reporting_year_settings')
      .upsert({
        local_unit_id: context.localUnitId,
        year_label: label,
        year_start_month: startMonth,
        year_start_day: startDay,
        is_local_override: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'local_unit_id' })

    if (error) throw new Error(error.message)
  }

  revalidatePath('/me/council')
  revalidatePath('/people/officers')
  revalidatePath('/events/volunteer-hours')
  redirect('/me/council')
}
