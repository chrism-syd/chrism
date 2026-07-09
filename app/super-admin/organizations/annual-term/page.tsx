import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import AutoDismissingQueryMessage from '@/app/components/auto-dismissing-query-message'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateParentOrganizationAnnualTermAction } from './actions'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type OrganizationFamilyAnnualTermRow = {
  id: string
  code: string | null
  display_name: string | null
  active: boolean | null
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

function organizationFamilyLabel(family: OrganizationFamilyAnnualTermRow) {
  return family.display_name?.trim() || family.code?.trim() || 'Parent organization'
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

function normalizeMode(value: string | null) {
  return value === 'custom' ? 'custom' : 'calendar'
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SuperAdminAnnualTermPage({ searchParams }: PageProps) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser || !permissions.isSuperAdmin || permissions.actingMode !== 'normal') {
    redirect('/me')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const errorMessage = typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : null
  const noticeMessage = typeof resolvedSearchParams.notice === 'string' ? resolvedSearchParams.notice : null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('organization_families')
    .select('id, code, display_name, active, annual_term_mode, annual_term_label, annual_term_start_month, annual_term_start_day')
    .order('display_name', { ascending: true })
    .returns<OrganizationFamilyAnnualTermRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  const families = (data ?? []).slice().sort((left, right) => organizationFamilyLabel(left).localeCompare(organizationFamilyLabel(right)))

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        {errorMessage ? (
          <AutoDismissingQueryMessage kind="error" message={errorMessage} className="qv-inline-message qv-inline-error" />
        ) : null}
        {noticeMessage ? (
          <AutoDismissingQueryMessage kind="notice" message={noticeMessage} className="qv-inline-message qv-inline-success" />
        ) : null}

        <section className="qv-hero-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              <p className="qv-eyebrow">Super admin</p>
              <h1 className="qv-directory-name">Parent organization annual terms</h1>
              <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
                Set the default operating year for umbrella organizations like Knights of Columbus, Society of St. Vincent de Paul, and Catholic Women&apos;s League. Local units inherit this value unless they have an explicit local override.
              </p>
              <div className="qv-form-actions" style={{ justifyContent: 'flex-start', marginTop: 16 }}>
                <Link href="/super-admin/organizations" className="qv-link-button qv-button-secondary">Back to organization manager</Link>
              </div>
            </div>
          </div>
        </section>

        <section className="qv-card" style={{ marginTop: 18 }}>
          <h2 className="qv-section-title">Umbrella defaults</h2>
          <p className="qv-section-subtitle">
            Calendar year always means January 1 to December 31. Custom years derive the end date automatically from the selected start date.
          </p>

          <div style={{ display: 'grid', gap: 18, marginTop: 18 }}>
            {families.length === 0 ? (
              <div className="qv-empty">
                <p className="qv-empty-title">No parent organizations yet</p>
                <p className="qv-empty-text">Create umbrella organization families first, then return here to set their annual terms.</p>
              </div>
            ) : families.map((family) => {
              const mode = normalizeMode(family.annual_term_mode)
              const label = family.annual_term_label?.trim() || (mode === 'custom' ? 'Annual Term' : 'Calendar Year')
              const startMonth = family.annual_term_start_month ?? 1
              const startDay = family.annual_term_start_day ?? 1
              const derivedEnd = formatDerivedEnd(startMonth, startDay)

              return (
                <article key={family.id} className="qv-card" style={{ background: 'var(--bg-sunken)' }}>
                  <div style={{ display: 'grid', gap: 4, marginBottom: 14 }}>
                    <h3 className="qv-section-title" style={{ margin: 0 }}>{organizationFamilyLabel(family)}</h3>
                    <p className="qv-section-subtitle" style={{ margin: 0 }}>Family code: {family.code ?? 'unknown'} · {family.active === false ? 'Inactive' : 'Active'}</p>
                    <p className="qv-section-subtitle" style={{ margin: 0 }}>
                      Current: {label} starts {monthLabel(startMonth)} {startDay}, ends {derivedEnd}
                    </p>
                  </div>

                  <form action={updateParentOrganizationAnnualTermAction} className="qv-form-grid">
                    <input type="hidden" name="organization_family_id" value={family.id} />

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
                          <span className="qv-section-subtitle" style={{ margin: 0 }}>Use labels like Fraternal Year, Fiscal Year, or Program Year.</span>
                        </span>
                      </label>

                      <div className="qv-inline-message" style={{ alignSelf: 'start' }}>
                        <strong>Inherited by local units</strong>
                        <p style={{ margin: '6px 0 0' }}>
                          This is the umbrella default. Council and conference-level admins can only set their own local override.
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
                    </div>
                  </form>
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}
