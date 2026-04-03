import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import AutoDismissingQueryMessage from '@/app/components/auto-dismissing-query-message'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { getSuperAdminDataHygieneSnapshot } from '@/lib/super-admin/data-hygiene'
import {
  cleanupRedundantEventAssignmentsAction,
  resolveAllNullUserFossilsAction,
  resolveSingleNullUserFossilAction,
} from './actions'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function formatReason(reason: string) {
  switch (reason) {
    case 'event_assignment_covered_by_all_events':
      return 'Covered by an all-events grant'
    case 'event_assignment_covered_by_event_kind':
      return 'Covered by an event-type grant'
    case 'event_kind_assignment_covered_by_all_events':
      return 'Event-type grant covered by an all-events grant'
    default:
      return reason.replaceAll('_', ' ')
  }
}

function formatSourceTable(value: string) {
  return value.replace(/^public\./, '').replaceAll('_', ' ')
}

function formatWhen(value: string | null) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SuperAdminDataHygienePage({ searchParams }: PageProps) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser || !permissions.isSuperAdmin || permissions.actingMode !== 'normal') {
    redirect('/me')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const errorMessage = typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : null
  const noticeMessage = typeof resolvedSearchParams.notice === 'string' ? resolvedSearchParams.notice : null

  const { summary, redundancyRows, fossilRows, resolvedFossilRows, readiness, errors } = await getSuperAdminDataHygieneSnapshot()
  const safeRedundancyRows = redundancyRows ?? []
  const safeFossilRows = fossilRows ?? []
  const safeResolvedFossilRows = resolvedFossilRows ?? []

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
          <div className="qv-hero-top">
            <div>
              <p className="qv-eyebrow">Super admin</p>
              <h1 className="qv-title">Data hygiene</h1>
              <p className="qv-subtitle">
                Low-risk cleanup for the new access model. This page helps you trim redundant event permissions,
                inspect legacy-retirement readiness, and resolve null-user fossil rows without pretending they are part
                of the new source of truth.
              </p>
            </div>
          </div>

          <div className="qv-stats">
            <div className="qv-stat-card">
              <div className="qv-stat-number">{summary.redundantEventAssignmentCount}</div>
              <div className="qv-stat-label">Redundant event assignments</div>
            </div>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{summary.nullUserFossilCount}</div>
              <div className="qv-stat-label">Open null-user fossils</div>
            </div>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{summary.resolvedNullUserFossilCount}</div>
              <div className="qv-stat-label">Resolved fossils</div>
            </div>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{summary.unresolvedLegacyWriteCount}</div>
              <div className="qv-stat-label">Unresolved legacy writes</div>
            </div>
          </div>
        </section>

        <section className="qv-card" style={{ marginTop: 20 }}>
          <div className="qv-results-row">
            <div className="qv-results-copy">
              <h2 className="qv-section-title">Retirement readiness</h2>
              <p className="qv-section-subtitle">
                This mirrors the database readiness view so you can see whether legacy compatibility tables are still leaking work.
              </p>
            </div>
            <span className={`qv-badge ${readiness?.gap_free ? 'qv-badge-soft' : ''}`}>
              {readiness?.gap_free ? 'Gap free' : 'Needs cleanup'}
            </span>
          </div>

          {errors.readiness || errors.legacyGaps ? (
            <div className="qv-card qv-error">
              Could not load retirement readiness. {[errors.readiness, errors.legacyGaps].filter(Boolean).join(' ')}
            </div>
          ) : (
            <>
              <div className="qv-stats" style={{ marginTop: 0 }}>
                <div className="qv-stat-card">
                  <div className="qv-stat-number">{readiness?.org_admin_gap_count ?? 0}</div>
                  <div className="qv-stat-label">Org admin gaps</div>
                </div>
                <div className="qv-stat-card">
                  <div className="qv-stat-number">{readiness?.custom_list_gap_count ?? 0}</div>
                  <div className="qv-stat-label">Custom list gaps</div>
                </div>
                <div className="qv-stat-card">
                  <div className="qv-stat-number">{readiness?.event_gap_count ?? 0}</div>
                  <div className="qv-stat-label">Event manager gaps</div>
                </div>
                <div className="qv-stat-card">
                  <div className="qv-stat-number">{summary.legacyGapCount}</div>
                  <div className="qv-stat-label">Total legacy gap rows</div>
                </div>
              </div>
              <p className="qv-helper-text" style={{ marginTop: 12 }}>
                Null-user fossil resolution only removes those rows from the active hygiene queue. It does not drop legacy tables or sever final retirement on its own.
              </p>
            </>
          )}
        </section>

        <section className="qv-card" style={{ marginTop: 20 }}>
          <div className="qv-results-row">
            <div className="qv-results-copy">
              <h2 className="qv-section-title">Redundant event assignments</h2>
              <p className="qv-section-subtitle">
                These are safe overlaps inside the new model, such as event-specific rows that are already covered by an all-events or event-type assignment. The list below shows the first 50 rows.
              </p>
            </div>
            <form action={cleanupRedundantEventAssignmentsAction}>
              <button type="submit" className="qv-button qv-button-secondary">
                Remove redundant rows
              </button>
            </form>
          </div>

          {errors.redundancy ? (
            <div className="qv-card qv-error">Could not load redundant event assignments. {errors.redundancy}</div>
          ) : safeRedundancyRows.length === 0 ? (
            <div className="qv-empty">
              <p className="qv-empty-title">No redundant event assignments found</p>
              <p className="qv-empty-text">
                The event assignment table looks tidy. Nothing is currently duplicated by broader grants.
              </p>
            </div>
          ) : (
            <div className="qv-member-list">
              {safeRedundancyRows.map((row) => (
                <div key={row.redundant_assignment_id} className="qv-member-row" style={{ alignItems: 'flex-start' }}>
                  <div className="qv-member-text" style={{ display: 'grid', gap: 6 }}>
                    <div className="qv-member-name">{row.event_title ?? 'All events / event type scope'}</div>
                    <div className="qv-member-meta">
                      {row.local_unit_name ?? 'Local unit'} • {formatReason(row.redundancy_reason)}
                    </div>
                    <div className="qv-member-meta">
                      Scope: {row.redundant_assignment_scope} • Role: {row.role_code ?? 'manager'} • User: {row.user_id ?? 'no linked user'}
                    </div>
                  </div>
                  <div className="qv-member-row-right">
                    <span className="qv-badge">Covered by {row.covered_by_scope}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="qv-card" style={{ marginTop: 20 }}>
          <div className="qv-results-row">
            <div className="qv-results-copy">
              <h2 className="qv-section-title">Null-user fossils</h2>
              <p className="qv-section-subtitle">
                These are legacy compatibility rows with a person or email target but no linked user. Resolving them here records an explicit “intentional residue” decision and removes them from the active hygiene queue without rewriting the new source of truth.
              </p>
            </div>
            <form action={resolveAllNullUserFossilsAction}>
              <button type="submit" className="qv-button qv-button-secondary" disabled={safeFossilRows.length === 0}>
                Resolve all fossils
              </button>
            </form>
          </div>

          {errors.fossils ? (
            <div className="qv-card qv-error">Could not load fossil rows. {errors.fossils}</div>
          ) : safeFossilRows.length === 0 ? (
            <div className="qv-empty">
              <p className="qv-empty-title">No open null-user fossils found</p>
              <p className="qv-empty-text">The active hygiene queue is clear of unresolved legacy residue.</p>
            </div>
          ) : (
            <div className="qv-member-list">
              {safeFossilRows.map((row) => (
                <div key={`${row.source_table}:${row.source_row_id}`} className="qv-member-row" style={{ alignItems: 'flex-start' }}>
                  <div className="qv-member-text" style={{ display: 'grid', gap: 6 }}>
                    <div className="qv-member-name">{formatSourceTable(row.source_table)}</div>
                    <div className="qv-member-meta">
                      {row.local_unit_name ?? 'Unmapped local unit'} • person {row.person_id ?? '—'} • email {row.grantee_email ?? '—'}
                    </div>
                    <div className="qv-member-meta">Created {formatWhen(row.created_at)}</div>
                    {row.notes ? <div className="qv-member-meta">{row.notes}</div> : null}
                  </div>
                  <div className="qv-member-row-right" style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                    <span className="qv-badge">Legacy residue</span>
                    <form action={resolveSingleNullUserFossilAction}>
                      <input type="hidden" name="source_table" value={row.source_table} />
                      <input type="hidden" name="source_row_id" value={row.source_row_id} />
                      <button type="submit" className="qv-button qv-button-secondary">
                        Resolve fossil
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="qv-card" style={{ marginTop: 20 }}>
          <div className="qv-results-copy" style={{ marginBottom: 16 }}>
            <h2 className="qv-section-title">Recently resolved fossils</h2>
            <p className="qv-section-subtitle">
              This is the audit trail for fossil rows that have already been marked as intentional residue. They stay visible here so cleanup decisions are inspectable instead of disappearing into the wallpaper.
            </p>
          </div>

          {errors.resolvedFossils ? (
            <div className="qv-card qv-error">Could not load resolved fossil rows. {errors.resolvedFossils}</div>
          ) : safeResolvedFossilRows.length === 0 ? (
            <div className="qv-empty">
              <p className="qv-empty-title">No fossils have been resolved yet</p>
              <p className="qv-empty-text">When you resolve a fossil row from the section above, it will appear here as an audit breadcrumb.</p>
            </div>
          ) : (
            <div className="qv-member-list">
              {safeResolvedFossilRows.map((row) => (
                <div key={`${row.source_table}:${row.source_row_id}:resolved`} className="qv-member-row" style={{ alignItems: 'flex-start' }}>
                  <div className="qv-member-text" style={{ display: 'grid', gap: 6 }}>
                    <div className="qv-member-name">{formatSourceTable(row.source_table)}</div>
                    <div className="qv-member-meta">
                      {row.local_unit_name ?? 'Unmapped local unit'} • person {row.person_id ?? '—'} • email {row.grantee_email ?? '—'}
                    </div>
                    <div className="qv-member-meta">
                      Resolved {formatWhen(row.fossil_resolved_at)} • {row.resolution_code ?? 'ignored residue'}
                    </div>
                    {row.resolution_notes ? <div className="qv-member-meta">{row.resolution_notes}</div> : null}
                  </div>
                  <div className="qv-member-row-right">
                    <span className="qv-badge qv-badge-soft">Resolved</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
