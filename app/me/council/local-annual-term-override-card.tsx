'use client'

import { usePathname } from 'next/navigation'
import { saveLocalAnnualTermOverrideAction } from './annual-term-override-actions'

type LocalAnnualTermOverrideCardProps = {
  parentLabel: string
  parentStartMonth: number
  parentStartDay: number
  localLabel: string
  localStartMonth: number
  localStartDay: number
  isLocalOverride: boolean
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

function monthLabel(month: number) {
  return MONTH_OPTIONS.find((option) => option.value === month)?.label ?? 'January'
}

function daysInMonth(month: number) {
  return new Date(Date.UTC(2024, month, 0, 12, 0, 0)).getUTCDate()
}

function formatTerm(label: string, month: number, day: number) {
  return `${label}: starts ${monthLabel(month)} ${day}`
}

export default function LocalAnnualTermOverrideCard(props: LocalAnnualTermOverrideCardProps) {
  const pathname = usePathname()
  if (pathname !== '/me/council') return null

  return (
    <div className="qv-page" style={{ paddingBottom: 0 }}>
      <div className="qv-shell" style={{ paddingBottom: 0 }}>
        <section className="qv-card" style={{ marginBottom: 18 }}>
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Local annual term override</h2>
              <p className="qv-section-subtitle">
                This local organization normally inherits the parent annual term. Use an override only when this local unit operates on a different year.
              </p>
            </div>
          </div>

          <form action={saveLocalAnnualTermOverrideAction} className="qv-form-grid">
            <div className="qv-form-row qv-form-row-2">
              <label className="qv-field" style={{ alignItems: 'flex-start' }}>
                <span>Mode</span>
                <span style={{ display: 'grid', gap: 8 }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="radio"
                      name="local_annual_term_mode"
                      value="inherit"
                      defaultChecked={!props.isLocalOverride}
                    />
                    <span>Inherit parent setting</span>
                  </label>
                  <span className="qv-section-subtitle" style={{ margin: 0 }}>
                    {formatTerm(props.parentLabel, props.parentStartMonth, props.parentStartDay)}
                  </span>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="radio"
                      name="local_annual_term_mode"
                      value="custom"
                      defaultChecked={props.isLocalOverride}
                    />
                    <span>Use local override</span>
                  </label>
                  <span className="qv-section-subtitle" style={{ margin: 0 }}>
                    Current local setting: {formatTerm(props.localLabel, props.localStartMonth, props.localStartDay)}
                  </span>
                </span>
              </label>

              <div className="qv-inline-message" style={{ alignSelf: 'start' }}>
                <strong>{props.isLocalOverride ? 'Local override active' : 'Inheriting parent default'}</strong>
                <p style={{ margin: '6px 0 0' }}>
                  Parent defaults are managed in super admin. This card only changes this local organization.
                </p>
              </div>
            </div>

            <div className="qv-form-row qv-form-row-3">
              <label className="qv-field">
                <span>Local label</span>
                <input name="local_annual_term_label" type="text" defaultValue={props.localLabel} placeholder="Fraternal Year" />
              </label>
              <label className="qv-field">
                <span>Starts month</span>
                <select name="local_annual_term_start_month" defaultValue={props.localStartMonth}>
                  {MONTH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="qv-field">
                <span>Starts day</span>
                <select name="local_annual_term_start_day" defaultValue={props.localStartDay}>
                  {Array.from({ length: daysInMonth(props.localStartMonth) }, (_, index) => index + 1).map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="qv-form-actions">
              <button type="submit" className="qv-button-primary">Save local annual term</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
