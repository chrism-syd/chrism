import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import AutoDismissingQueryMessage from '@/app/components/auto-dismissing-query-message'
import OrganizationAvatar from '@/app/components/organization-avatar'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getManagedLocalUnitKindOptions,
  getManagedVisibilityOptions,
  listManagedOrganizationTypeOptions,
} from '@/lib/organizations/management'
import {
  createLocalUnitAction,
  createOrganizationAction,
  updateOrganizationAction,
} from './actions'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type OrganizationRow = {
  id: string
  display_name: string | null
  preferred_name: string | null
  organization_type_code: string
  primary_color_hex: string | null
  secondary_color_hex: string | null
  logo_storage_path: string | null
  logo_alt_text: string | null
}

type LocalUnitRow = {
  id: string
  legacy_organization_id: string | null
  legacy_council_id: string | null
  display_name: string | null
  official_name: string | null
  local_unit_kind: string | null
  status: string | null
  visibility: string | null
  created_at: string | null
}

type CouncilRow = {
  id: string
  organization_id: string
  council_number: string
  timezone: string
  name: string
}

function organizationLabel(organization: Pick<OrganizationRow, 'preferred_name' | 'display_name'>) {
  return organization.preferred_name?.trim() || organization.display_name?.trim() || 'Organization'
}

function formatWhen(value: string | null) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SuperAdminOrganizationsPage({ searchParams }: PageProps) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser || !permissions.isSuperAdmin || permissions.actingMode !== 'normal') {
    redirect('/me')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const errorMessage = typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : null
  const noticeMessage = typeof resolvedSearchParams.notice === 'string' ? resolvedSearchParams.notice : null

  const admin = createAdminClient()
  const [organizationTypes, organizationsResponse, localUnitsResponse, councilsResponse] = await Promise.all([
    listManagedOrganizationTypeOptions({ admin }),
    admin
      .from('organizations')
      .select('id, display_name, preferred_name, organization_type_code, primary_color_hex, secondary_color_hex, logo_storage_path, logo_alt_text')
      .order('display_name', { ascending: true }),
    admin
      .from('local_units')
      .select('id, legacy_organization_id, legacy_council_id, display_name, official_name, local_unit_kind, status, visibility, created_at')
      .order('created_at', { ascending: true }),
    admin
      .from('councils')
      .select('id, organization_id, council_number, timezone, name')
      .order('name', { ascending: true }),
  ])

  const organizations = ((organizationsResponse.data as OrganizationRow[] | null) ?? [])
    .slice()
    .sort((left, right) => organizationLabel(left).localeCompare(organizationLabel(right)))
  const localUnits = (localUnitsResponse.data as LocalUnitRow[] | null) ?? []
  const councils = (councilsResponse.data as CouncilRow[] | null) ?? []

  const localUnitsByOrganizationId = new Map<string, LocalUnitRow[]>()
  for (const row of localUnits) {
    if (!row.legacy_organization_id) continue
    const bucket = localUnitsByOrganizationId.get(row.legacy_organization_id) ?? []
    bucket.push(row)
    localUnitsByOrganizationId.set(row.legacy_organization_id, bucket)
  }

  const councilsById = new Map(councils.map((row) => [row.id, row]))
  const localUnitKindOptions = getManagedLocalUnitKindOptions()
  const visibilityOptions = getManagedVisibilityOptions()

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

        <section className="qv-card">
          <h1 className="qv-section-title">Organization manager</h1>
          <p className="qv-section-subtitle">
            Create parent organizations, add local units, update branding, and seed the first admin invite without touching the database by hand.
          </p>
        </section>

        <section className="qv-card" style={{ marginTop: 18 }}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <h2 className="qv-section-title">Create organization + first local unit</h2>
              <p className="qv-section-subtitle">
                This creates the parent organization record, its first local unit, and optionally sends the first admin invite. Council local units also get a legacy council shell so the current preview surfaces can still breathe.
              </p>
            </div>

            <form action={createOrganizationAction} className="qv-form-grid">
              <div className="qv-form-row qv-form-row-2">
                <label className="qv-field">
                  <span>Organization name</span>
                  <input name="display_name" type="text" required placeholder="Knights of Columbus Ontario" />
                </label>
                <label className="qv-field">
                  <span>Preferred name</span>
                  <input name="preferred_name" type="text" placeholder="K of C Ontario" />
                </label>
              </div>

              <div className="qv-form-row qv-form-row-3">
                <label className="qv-field">
                  <span>Organization type</span>
                  <select name="organization_type_code" required defaultValue={organizationTypes[0]?.code ?? ''}>
                    {organizationTypes.map((type) => (
                      <option key={type.code} value={type.code}>{type.label}</option>
                    ))}
                  </select>
                </label>
                <label className="qv-field">
                  <span>Primary color</span>
                  <input name="primary_color_hex" type="text" placeholder="#4b2e5e" />
                </label>
                <label className="qv-field">
                  <span>Secondary color</span>
                  <input name="secondary_color_hex" type="text" placeholder="#ceb5da" />
                </label>
              </div>

              <div className="qv-form-row qv-form-row-2">
                <label className="qv-field">
                  <span>Logo file</span>
                  <input name="logo_file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
                </label>
                <label className="qv-field">
                  <span>Logo alt text</span>
                  <input name="logo_alt_text" type="text" placeholder="Organization crest" />
                </label>
              </div>

              <div className="qv-form-row qv-form-row-3">
                <label className="qv-field">
                  <span>First local unit kind</span>
                  <select name="first_local_unit_kind" defaultValue="council">
                    {localUnitKindOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="qv-field">
                  <span>First local unit display name</span>
                  <input name="first_local_unit_display_name" type="text" required placeholder="Council 7689" />
                </label>
                <label className="qv-field">
                  <span>First local unit official name</span>
                  <input name="first_local_unit_official_name" type="text" placeholder="St. Mary Council 7689" />
                </label>
              </div>

              <div className="qv-form-row qv-form-row-3">
                <label className="qv-field">
                  <span>Visibility</span>
                  <select name="first_local_unit_visibility" defaultValue="private">
                    {visibilityOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="qv-field">
                  <span>Council number</span>
                  <input name="first_council_number" type="text" placeholder="7689" />
                </label>
                <label className="qv-field">
                  <span>Timezone</span>
                  <input name="first_council_timezone" type="text" defaultValue="America/Toronto" />
                </label>
              </div>

              <div className="qv-form-row qv-form-row-3">
                <label className="qv-field">
                  <span>Initial admin email</span>
                  <input name="initial_admin_email" type="email" placeholder="leader@example.org" />
                </label>
                <label className="qv-field">
                  <span>Initial admin name</span>
                  <input name="initial_admin_name" type="text" placeholder="Chris Martin" />
                </label>
                <label className="qv-field">
                  <span>Invite notes</span>
                  <input name="initial_admin_notes" type="text" placeholder="Use this to finish setup and import members." />
                </label>
              </div>

              <div className="qv-form-actions">
                <button type="submit" className="qv-button-primary">Create organization</button>
              </div>
            </form>
          </div>
        </section>

        <section className="qv-card" style={{ marginTop: 18 }}>
          <h2 className="qv-section-title">Existing organizations</h2>
          <p className="qv-section-subtitle">
            Update metadata, refresh branding, and add new local units without leaving the super-admin lane.
          </p>

          <div style={{ display: 'grid', gap: 18, marginTop: 18 }}>
            {organizations.length === 0 ? (
              <div className="qv-empty">
                <p className="qv-empty-title">No organizations yet</p>
                <p className="qv-empty-text">Create the first one above, then come back here to add more local units or update branding.</p>
              </div>
            ) : organizations.map((organization) => {
              const label = organizationLabel(organization)
              const units = (localUnitsByOrganizationId.get(organization.id) ?? []).slice().sort((left, right) => {
                const leftLabel = left.display_name?.trim() || left.official_name?.trim() || 'Local unit'
                const rightLabel = right.display_name?.trim() || right.official_name?.trim() || 'Local unit'
                return leftLabel.localeCompare(rightLabel)
              })
              const inviteCouncil = units.find((unit) => Boolean(unit.legacy_council_id)) ?? null
              const inviteCouncilShell = inviteCouncil?.legacy_council_id ? councilsById.get(inviteCouncil.legacy_council_id) ?? null : null

              return (
                <article key={organization.id} className="qv-card" style={{ background: 'var(--bg-sunken)' }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14 }}>
                    <OrganizationAvatar
                      displayName={label}
                      logoStoragePath={organization.logo_storage_path}
                      logoAltText={organization.logo_alt_text}
                      size={64}
                    />
                    <div style={{ display: 'grid', gap: 4 }}>
                      <h3 className="qv-section-title" style={{ margin: 0 }}>{label}</h3>
                      <p className="qv-section-subtitle" style={{ margin: 0 }}>
                        Type: {organization.organization_type_code} • {units.length} local unit{units.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <form action={updateOrganizationAction} className="qv-form-grid">
                    <input type="hidden" name="organization_id" value={organization.id} />
                    <input type="hidden" name="invite_council_id" value={inviteCouncilShell?.id ?? ''} />
                    <input type="hidden" name="invite_council_name" value={inviteCouncilShell?.name ?? inviteCouncil?.display_name ?? ''} />
                    <input type="hidden" name="invite_council_number" value={inviteCouncilShell?.council_number ?? ''} />

                    <div className="qv-form-row qv-form-row-2">
                      <label className="qv-field">
                        <span>Organization name</span>
                        <input name="display_name" type="text" required defaultValue={organization.display_name ?? ''} />
                      </label>
                      <label className="qv-field">
                        <span>Preferred name</span>
                        <input name="preferred_name" type="text" defaultValue={organization.preferred_name ?? ''} />
                      </label>
                    </div>

                    <div className="qv-form-row qv-form-row-3">
                      <label className="qv-field">
                        <span>Organization type</span>
                        <select name="organization_type_code" defaultValue={organization.organization_type_code}>
                          {organizationTypes.map((type) => (
                            <option key={type.code} value={type.code}>{type.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="qv-field">
                        <span>Primary color</span>
                        <input name="primary_color_hex" type="text" defaultValue={organization.primary_color_hex ?? ''} placeholder="#4b2e5e" />
                      </label>
                      <label className="qv-field">
                        <span>Secondary color</span>
                        <input name="secondary_color_hex" type="text" defaultValue={organization.secondary_color_hex ?? ''} placeholder="#ceb5da" />
                      </label>
                    </div>

                    <div className="qv-form-row qv-form-row-2">
                      <label className="qv-field">
                        <span>Replace logo</span>
                        <input name="logo_file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
                      </label>
                      <label className="qv-field">
                        <span>Logo alt text</span>
                        <input name="logo_alt_text" type="text" defaultValue={organization.logo_alt_text ?? ''} placeholder="Organization crest" />
                      </label>
                    </div>

                    <div className="qv-form-row qv-form-row-3">
                      <label className="qv-field">
                        <span>Invite another admin by email</span>
                        <input name="initial_admin_email" type="email" placeholder="leader@example.org" />
                      </label>
                      <label className="qv-field">
                        <span>Admin name</span>
                        <input name="initial_admin_name" type="text" placeholder="Chris Martin" />
                      </label>
                      <label className="qv-field">
                        <span>Invite notes</span>
                        <input name="initial_admin_notes" type="text" placeholder="Use this link to finish setup." />
                      </label>
                    </div>

                    <div className="qv-form-actions">
                      <button type="submit" className="qv-button-primary">Save organization</button>
                    </div>
                  </form>

                  <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
                    <div>
                      <h4 className="qv-section-title" style={{ margin: 0 }}>Local units</h4>
                      <p className="qv-section-subtitle" style={{ margin: '4px 0 0' }}>
                        Parishes and other non-council units are created on the new model now. Council units also get the legacy council shell the current preview still expects.
                      </p>
                    </div>

                    {units.length === 0 ? (
                      <div className="qv-empty">
                        <p className="qv-empty-title">No local units yet</p>
                        <p className="qv-empty-text">Add the first local unit below.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {units.map((unit) => {
                          const councilShell = unit.legacy_council_id ? councilsById.get(unit.legacy_council_id) ?? null : null
                          return (
                            <div key={unit.id} className="qv-inline-message" style={{ display: 'grid', gap: 4 }}>
                              <strong>{unit.display_name?.trim() || unit.official_name?.trim() || 'Local unit'}</strong>
                              <span>
                                {unit.local_unit_kind ?? 'other'} • {unit.visibility ?? 'private'} • {unit.status ?? 'active'}
                                {councilShell ? ` • Council ${councilShell.council_number}` : ''}
                              </span>
                              <span>Created {formatWhen(unit.created_at)}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <form action={createLocalUnitAction} className="qv-form-grid" style={{ marginTop: 4 }}>
                      <input type="hidden" name="organization_id" value={organization.id} />
                      <input type="hidden" name="organization_name" value={label} />

                      <div className="qv-form-row qv-form-row-3">
                        <label className="qv-field">
                          <span>Kind</span>
                          <select name="local_unit_kind" defaultValue="council">
                            {localUnitKindOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="qv-field">
                          <span>Display name</span>
                          <input name="display_name" type="text" required placeholder="Council 7689" />
                        </label>
                        <label className="qv-field">
                          <span>Official name</span>
                          <input name="official_name" type="text" placeholder="St. Mary Council 7689" />
                        </label>
                      </div>

                      <div className="qv-form-row qv-form-row-3">
                        <label className="qv-field">
                          <span>Visibility</span>
                          <select name="visibility" defaultValue="private">
                            {visibilityOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="qv-field">
                          <span>Council number</span>
                          <input name="council_number" type="text" placeholder="7689" />
                        </label>
                        <label className="qv-field">
                          <span>Timezone</span>
                          <input name="timezone" type="text" defaultValue="America/Toronto" />
                        </label>
                      </div>

                      <div className="qv-form-row qv-form-row-3">
                        <label className="qv-field">
                          <span>Invite first admin email</span>
                          <input name="initial_admin_email" type="email" placeholder="leader@example.org" />
                        </label>
                        <label className="qv-field">
                          <span>Admin name</span>
                          <input name="initial_admin_name" type="text" placeholder="Chris Martin" />
                        </label>
                        <label className="qv-field">
                          <span>Invite notes</span>
                          <input name="initial_admin_notes" type="text" placeholder="Use this to finish local setup." />
                        </label>
                      </div>

                      <div className="qv-form-actions">
                        <button type="submit" className="qv-button-secondary">Add local unit</button>
                      </div>
                    </form>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}
