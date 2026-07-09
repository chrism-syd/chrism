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

function redirectToAnnualTermSettings(args: { error?: string | null; notice?: string | null }): never {
  const params = new URLSearchParams()
  if (args.error) params.set('error', args.error)
  if (args.notice) params.set('notice', args.notice)
  redirect(params.size > 0 ? `/me/council/settings/annual-term?${params.toString()}` : '/me/council/settings/annual-term')
}

function isValidMonthDay(month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const candidate = new Date(Date.UTC(2024, month - 1, day, 12, 0, 0))
  return candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day
}

function normalizeAnnualTermLabel(value: string | null, mode: string) {
  if (mode === 'calendar') return 'Calendar Year'
  return value?.trim() || 'Annual Term'
}

export async function updateAnnualTermSettingsAction(formData: FormData) {
  const context = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/me',
    areaCode: 'local_unit_settings',
    minimumAccessLevel: 'manage',
  })

  if (!context.permissions.organizationId || !context.permissions.canAccessOrganizationSettings) {
    redirect('/me')
  }

  const rawMode = textValue(formData, 'annual_term_mode') ?? 'calendar'
  const mode = rawMode === 'custom' ? 'custom' : 'calendar'
  const label = normalizeAnnualTermLabel(textValue(formData, 'annual_term_label'), mode)
  const startMonth = mode === 'calendar' ? 1 : numberValue(formData, 'annual_term_start_month')
  const startDay = mode === 'calendar' ? 1 : numberValue(formData, 'annual_term_start_day')

  if (!startMonth || !startDay || !isValidMonthDay(startMonth, startDay)) {
    redirectToAnnualTermSettings({ error: 'Choose a valid annual term start month and day.' })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('organizations')
    .update({
      annual_term_mode: mode,
      annual_term_label: label,
      annual_term_start_month: startMonth,
      annual_term_start_day: startDay,
      updated_by_auth_user_id: context.permissions.authUser!.id,
    })
    .eq('id', context.permissions.organizationId)

  if (error) {
    redirectToAnnualTermSettings({ error: error.message })
  }

  revalidatePath('/me/council')
  revalidatePath('/me/council/settings/annual-term')
  revalidatePath('/people/officers')
  revalidatePath('/events/volunteer-hours')

  redirectToAnnualTermSettings({ notice: 'Annual term settings saved.' })
}
