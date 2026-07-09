import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateAnnualTermSettingsAction } from './actions'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type OrganizationAnnualTermRow = {
  id: string
  display_name: string | null
  preferred_name: string | null
  annual_term_mode: string | null
  annual_term_label: string | null
  annual_term_start_month: number | null
  annual_term_start_day: number | null
}

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

function organizationLabel(organization: OrganizationAnnualTermRow | null) {
  return organization?.preferred_name?.trim() || organization?.display_name?.trim() || 'Parent organization'
}

function monthLabel(month: number) {
  return MONTH_OPTIONS.find((option) => option.value === month)?.label ?? 'January'
}

function daysInMonth(month: number) {
  return new Date(Date.UTC(2024, month, 0, 12, 0, 0)).getUTCDate()
}

function formatDerivedEnd(month: number, day: number) {
  const start = new Date(Date.UTC(2024, month - 1, day, 12, 0, 0))
  const end = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate(), 12, 0, 0))
  end.setUTCDate(end.getUTCDate() - 1)
  return `${monthLabel(end.getUTCMonth() + 1)} ${end.getUTCDate()}`
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AnnualTermSettingsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const errorMessage = typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : null
  const noticeMessage = typeof resolvedSearchParams.notice === 'string' ? resolvedSearchParams.notice : null

  const context = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/me',
    areaCode: 'local_unit_settings',
    minimumAccessLevel: 'manage',
  })

  if (!context.permissions.organizationId || !context.permissions.canAccessOrganizationSettings) {
    redirect('/me')
  }

  const admin = createAdminClient()
  const { data: organization, error } = await admin
    .from('organizations')
    .select('id, display_name, preferred_name, annual_term_mode, annual_term_label, annual_term_start_month, annual_term_start_day')
    .eq('id', context.permissions.organizationId)
    .maybeSingle<OrganizationAnnualTermRow>()

  if (error) {
    throw new Error(error.message)
  }

  const mode = organization?.annual_term_mode === 'custom' ? 'custom' : 'calendar'
  const label = organization?.annual_term_label?.trim() || (mode === 'custom' ? 'Annual Term' : 'Calendar Year')
  const startMonth = organization?.annual_term_start_month ?? 1
  const startDay = organization?.annual_term_start_day ?? 1
  const derivedEndLabel = formatDerivedEnd(startMonth, startDay)

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              <p className="qv-eyebrow">{organizationLabel(organization)}</p>
              <h1 className="qv-directory-name">Annual term</h1>
              <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
                Choose how this parent organization defines its operating year. Local organizations inherit this for officer service years, reporting, and annual dashboards.
              </p>
            </div>
          </div>
        </section>

        {noticeMessage ? (
          <section className="qv-card" aria-live="polite" style={{ marginTop: 18 }}>
            <p style={{ margin: 0 }}>{noticeMessage}</p>
          </section>
        ) : null}

        {errorMessage ? (
          <section className="qv-card qv-error" role="alert" style={{ marginTop: 18 }}>
            <p style={{ margin: 0 }}>{errorMessage}</p>
          </section>
        ) : null}

        <section className="qv-card" style={{ marginTop: 20 }}>
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Parent organization annual term</h2>
              <p className="qv-section-subtitle">
                Calendar year starts January 1. Custom terms let organizations use labels like Fraternal Year, Fiscal Year, or Program Year.
              </p>
            </div>
          </div>

          <form action={updateAnnualTermSettingsAction} className="qv-form-grid">
            <div className="qv-form-row qv-form-row-2">
              <label className="qv-field" style={{ alignItems: 'flex-start' }}>
                <span>Term type</span>
                <span style={{ display: 'grid', gap: 8 }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="radio" name="annual_term_mode" value="calendar" defaultChecked={mode === 'calendar'} />
                    <span>Calendar year</span>
                  </label>
                  <span className="qv-section-subtitle" style={{ margin: 0 }}>January 1 to December 31</span>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="radio" name="annual_term_mode" value="custom" defaultChecked={mode === 'custom'} />
                    <span>Custom year</span>
                  </label>
                  <span className="qv-section-subtitle" style={{ margin: 0 }}>Choose a label and start date. The end date is derived automatically.</span>
                </span>
              </label>

              <div className="qv-inline-message" style={{ alignSelf: 'start' }}>
                <strong>Current setting</strong>
                <p style={{ margin: '6px 0 0' }}>
                  {label}: starts {monthLabel(startMonth)} {startDay}, ends {derivedEndLabel}
                </p>
              </div>
            </div>

            <div className="qv-form-row qv-form-row-3">
              <label className="qv-field">
                <span>Label</span>
                <input name="annual_term_label" type="text" defaultValue={label} placeholder="Fraternal Year" />
              </label>
              <label className="qv-field">
                <span>Starts month</span>
                <select name="annual_term_start_month" defaultValue={startMonth}>
                  {MONTH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="qv-field">
                <span>Starts day</span>
                <select name="annual_term_start_day" defaultValue={startDay}>
                  {Array.from({ length: daysInMonth(startMonth) }, (_, index) => index + 1).map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="qv-form-actions">
              <button type="submit" className="qv-button-primary">Save annual term</button>
              <Link href="/me/council" className="qv-link-button qv-button-secondary">Back to organization settings</Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}
