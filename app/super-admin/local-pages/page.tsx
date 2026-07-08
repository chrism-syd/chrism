import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import OrganizationAvatar from '@/app/components/organization-avatar'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import { createAdminClient } from '@/lib/supabase/admin'

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

type OrganizationRow = {
  id: string
  display_name: string | null
  preferred_name: string | null
  organization_type_code: string | null
  logo_storage_path: string | null
  logo_alt_text: string | null
  brand_profile?: {
    code: string | null
    display_name: string | null
    logo_storage_bucket: string | null
    logo_storage_path: string | null
    logo_alt_text: string | null
  } | null
}

type CouncilRow = {
  id: string
  name: string | null
  council_number: string | null
}

function localUnitLabel(unit: LocalUnitRow, council?: CouncilRow | null) {
  return unit.display_name?.trim() || unit.official_name?.trim() || council?.name?.trim() || 'Local organization'
}

function kindLabel(kind?: string | null) {
  if (kind === 'council') return 'Council'
  if (kind === 'parish') return 'Parish'
  if (kind === 'ministry') return 'Ministry'
  if (kind === 'conference') return 'Conference'
  return 'Local organization'
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SuperAdminLocalPagesIndex() {
  const permissions = await getCurrentUserPermissions()

  if (!permissions.authUser || !permissions.isSuperAdmin || permissions.actingMode !== 'normal') {
    redirect('/me')
  }

  const admin = createAdminClient()
  const [localUnitsResponse, organizationsResponse, councilsResponse] = await Promise.all([
    admin
      .from('local_units')
      .select('id, legacy_organization_id, legacy_council_id, display_name, official_name, local_unit_kind, status, visibility, created_at')
      .order('created_at', { ascending: false })
      .returns<LocalUnitRow[]>(),
    admin
      .from('organizations')
      .select('id, display_name, preferred_name, organization_type_code, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)')
      .returns<OrganizationRow[]>(),
    admin
      .from('councils')
      .select('id, name, council_number')
      .returns<CouncilRow[]>(),
  ])

  const localUnits = localUnitsResponse.data ?? []
  const organizationsById = new Map((organizationsResponse.data ?? []).map((organization) => [organization.id, organization]))
  const councilsById = new Map((councilsResponse.data ?? []).map((council) => [council.id, council]))

  const sortedLocalUnits = localUnits.slice().sort((left, right) => {
    const leftCouncil = left.legacy_council_id ? councilsById.get(left.legacy_council_id) ?? null : null
    const rightCouncil = right.legacy_council_id ? councilsById.get(right.legacy_council_id) ?? null : null
    return localUnitLabel(left, leftCouncil).localeCompare(localUnitLabel(right, rightCouncil))
  })

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader permissions={permissions} />

        <section className="qv-card">
          <p className="qv-eyebrow">Super admin preview</p>
          <h1 className="qv-section-title">Local pages</h1>
          <p className="qv-section-subtitle">
            Preview generated one-page websites for local organizations. These are not public-linked yet.
          </p>
        </section>

        <section className="qv-card" style={{ marginTop: 18 }}>
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Choose a local organization</h2>
              <p className="qv-section-subtitle">
                First iteration: generated copy, existing organization data, upcoming events, meeting links, contact routing, and public gallery images.
              </p>
            </div>
          </div>

          {sortedLocalUnits.length === 0 ? (
            <div className="qv-empty">
              <h3 className="qv-empty-title">No local units yet</h3>
              <p className="qv-empty-text">Create a local unit before previewing a local page.</p>
            </div>
          ) : (
            <div className="qv-member-list">
              {sortedLocalUnits.map((unit) => {
                const organization = unit.legacy_organization_id ? organizationsById.get(unit.legacy_organization_id) ?? null : null
                const council = unit.legacy_council_id ? councilsById.get(unit.legacy_council_id) ?? null : null
                const displayName = localUnitLabel(unit, council)
                const organizationName = organization ? getEffectiveOrganizationName(organization) : null
                const branding = organization ? getEffectiveOrganizationBranding(organization) : null

                return (
                  <article key={unit.id} className="qv-member-row">
                    <div className="qv-member-main">
                      <OrganizationAvatar
                        displayName={displayName}
                        logoStoragePath={branding?.logo_storage_path ?? null}
                        logoAltText={branding?.logo_alt_text ?? displayName}
                        size={52}
                      />
                      <div className="qv-member-text">
                        <div className="qv-member-name">{displayName}</div>
                        <div className="qv-member-meta">
                          {kindLabel(unit.local_unit_kind)}
                          {council?.council_number ? ` • Council ${council.council_number}` : ''}
                          {organizationName ? ` • ${organizationName}` : ''}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                          <span className="qv-mini-pill">{unit.status ?? 'active'}</span>
                          <span className="qv-mini-pill">{unit.visibility ?? 'private'}</span>
                          <span className="qv-mini-pill">Preview only</span>
                        </div>
                      </div>
                    </div>
                    <div className="qv-member-row-right">
                      <Link href={`/super-admin/local-pages/${unit.id}`} className="qv-link-button qv-button-primary">
                        Preview Page
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
