import type { ReactNode } from 'react'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { createAdminClient } from '@/lib/supabase/admin'
import LocalAnnualTermOverrideCard from './local-annual-term-override-card'

type AnnualTermFamilyRow = {
  annual_term_label: string | null
  annual_term_start_month: number | null
  annual_term_start_day: number | null
}

type LocalUnitFamilyRow = {
  organization_family_id: string | null
}

type LocalReportingYearRow = {
  year_label: string
  year_start_month: number
  year_start_day: number
  is_local_override: boolean | null
}

async function loadAnnualTermCardProps() {
  try {
    const context = await getCurrentActingCouncilContext({
      requireAdmin: true,
      redirectTo: '/me',
      areaCode: 'local_unit_settings',
      minimumAccessLevel: 'manage',
    })

    if (!context.localUnitId || !context.permissions.canAccessOrganizationSettings) {
      return null
    }

    const admin = createAdminClient()
    const { data: localUnit } = await admin
      .from('local_units')
      .select('organization_family_id')
      .eq('id', context.localUnitId)
      .maybeSingle<LocalUnitFamilyRow>()

    const [familyResult, localSettingsResult] = await Promise.all([
      localUnit?.organization_family_id
        ? admin
            .from('organization_families')
            .select('annual_term_label, annual_term_start_month, annual_term_start_day')
            .eq('id', localUnit.organization_family_id)
            .maybeSingle<AnnualTermFamilyRow>()
        : Promise.resolve({ data: null }),
      admin
        .from('local_unit_reporting_year_settings')
        .select('year_label, year_start_month, year_start_day, is_local_override')
        .eq('local_unit_id', context.localUnitId)
        .maybeSingle<LocalReportingYearRow>(),
    ])

    const parent = familyResult.data
    const local = localSettingsResult.data
    const parentLabel = parent?.annual_term_label?.trim() || 'Calendar Year'
    const parentStartMonth = parent?.annual_term_start_month ?? 1
    const parentStartDay = parent?.annual_term_start_day ?? 1

    return {
      parentLabel,
      parentStartMonth,
      parentStartDay,
      localLabel: local?.year_label?.trim() || parentLabel,
      localStartMonth: local?.year_start_month ?? parentStartMonth,
      localStartDay: local?.year_start_day ?? parentStartDay,
      isLocalOverride: Boolean(local?.is_local_override),
    }
  } catch {
    return null
  }
}

export default async function CouncilSettingsLayout({ children }: { children: ReactNode }) {
  const annualTermProps = await loadAnnualTermCardProps()

  return (
    <>
      {children}
      {annualTermProps ? <LocalAnnualTermOverrideCard {...annualTermProps} /> : null}
    </>
  )
}
