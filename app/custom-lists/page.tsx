import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import MembersList from '@/app/members-list'
import OrganizationAvatar from '@/app/components/organization-avatar'
import SectionMenuBar from '@/app/components/section-menu-bar'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { getSelectedOperationsLocalUnitId, OPERATIONS_SCOPE_COOKIE } from '@/lib/auth/operations-scope-selection'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  formatDateTime,
  listExplicitlySharedCustomListIdsForUser,
  listManageableLocalUnitIdsForCustomLists,
  type CustomListRow,
} from '@/lib/custom-lists'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import { type OrganizationProfileRow } from '@/lib/organizations/profile'
import { loadLocalUnitMemberDirectoryData } from '@/lib/members/directory-data'

type CountRow = {
  custom_list_id: string
}

type OrganizationRow = OrganizationProfileRow

type LocalUnitRow = {
  id: string
  display_name: string | null
  legacy_organization_id?: string | null
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function normalizeSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

async function loadOrganizationProfileForLocalUnit(args: {
  admin: ReturnType<typeof createAdminClient>
  localUnitId: string | null
}) {
  const { admin, localUnitId } = args

  if (!localUnitId) {
    return {
      localUnit: null as LocalUnitRow | null,
      organization: null as OrganizationRow | null,
    }
  }

  const { data: localUnitData, error: localUnitError } = await admin
    .from('local_units')
    .select('id, display_name, legacy_organization_id')
    .eq('id', localUnitId)
    .maybeSingle<LocalUnitRow>()

  if (localUnitError) {
    throw new Error(`Could not load local organization context. ${localUnitError.message}`)
  }

  const localUnit = (localUnitData as LocalUnitRow | null) ?? null

  if (!localUnit?.legacy_organization_id) {
    return {
      localUnit,
      organization: null as OrganizationRow | null,
    }
  }

  const { data: organizationData, error: organizationError } = await admin
    .from('organizations')
    .select(
      'display_name, preferred_name, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)'
    )
    .eq('id', localUnit.legacy_organization_id)
    .maybeSingle()

  if (organizationError) {
    throw new Error(`Could not load organization branding. ${organizationError.message}`)
  }

  return {
    localUnit,
    organization: (organizationData as OrganizationRow | null) ?? null,
  }
}

export default async function CustomListsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const showMemberDirectory = normalizeSingleParam(resolvedSearchParams.showMemberDirectory) === '1'
  const permissions = await getCurrentUserPermissions()

  if (!permissions.authUser) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const cookieStore = await cookies()
  const selectedLocalUnitId = getSelectedOperationsLocalUnitId({
    rawCookieValue: cookieStore.get(OPERATIONS_SCOPE_COOKIE)?.value ?? null,
  })

  const [manageableLocalUnitIds, sharedListIds] = await Promise.all([
    permissions.hasStaffAccess
      ? listManageableLocalUnitIdsForCustomLists({ admin, permissions })
      : Promise.resolve([] as string[]),
    listExplicitlySharedCustomListIdsForUser({ admin, permissions }),
  ])

  if (!permissions.hasStaffAccess && sharedListIds.length === 0) {
    redirect('/me')
  }

  const activeManageLocalUnitId =
    (selectedLocalUnitId && manageableLocalUnitIds.includes(selectedLocalUnitId) ? selectedLocalUnitId : null) ??
    (permissions.activeLocalUnitId && manageableLocalUnitIds.includes(permissions.activeLocalUnitId)
      ? permissions.activeLocalUnitId
      : null) ??
    (manageableLocalUnitIds.length === 1 ? manageableLocalUnitIds[0] : null)

  const manageScopeLocalUnitIds =
    activeManageLocalUnitId && manageableLocalUnitIds.includes(activeManageLocalUnitId)
      ? [activeManageLocalUnitId]
      : manageableLocalUnitIds

  if (manageScopeLocalUnitIds.length === 0 && sharedListIds.length === 0) {
    redirect('/me')
  }

  const memberDirectoryLocalUnitId =
    permissions.canManageCustomLists && manageableLocalUnitIds.length > 0
      ? activeManageLocalUnitId ?? (manageableLocalUnitIds.length === 1 ? manageableLocalUnitIds[0] : null)
      : null

  let query = admin
    .from('custom_lists')
    .select('id, council_id, local_unit_id, name, description, archived_at, created_at, updated_at, created_by_auth_user_id, updated_by_auth_user_id')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })

  const filters: string[] = []

  if (manageScopeLocalUnitIds.length > 0) {
    filters.push(`local_unit_id.in.(${manageScopeLocalUnitIds.join(',')})`)
  }

  if (sharedListIds.length > 0) {
    filters.push(`id.in.(${sharedListIds.join(',')})`)
  }

  if (filters.length === 1) {
    query = query.or(filters[0])
  } else if (filters.length > 1) {
    query = query.or(filters.join(','))
  }

  const { data: listRows, error: listError } = await query.returns<CustomListRow[]>()
  if (listError) {
    throw new Error(`Could not load custom lists. ${listError.message}`)
  }

  const lists = listRows ?? []
  const listIds = lists.map((list) => list.id)
  const listLocalUnitIds = [...new Set(lists.map((list) => list.local_unit_id).filter((value): value is string => Boolean(value)))]

  const [memberCountResult, accessCountResult, localUnitsResult, manageableUnitsResult] = await Promise.all([
    listIds.length > 0
      ? admin.from('custom_list_members').select('custom_list_id').in('custom_list_id', listIds).returns<CountRow[]>()
      : Promise.resolve({ data: [] as CountRow[] }),
    listIds.length > 0
      ? admin.from('custom_list_access').select('custom_list_id').in('custom_list_id', listIds).returns<CountRow[]>()
      : Promise.resolve({ data: [] as CountRow[] }),
    listLocalUnitIds.length > 0
      ? admin.from('local_units').select('id, display_name').in('id', listLocalUnitIds).returns<LocalUnitRow[]>()
      : Promise.resolve({ data: [] as LocalUnitRow[] }),
    manageableLocalUnitIds.length > 0
      ? admin.from('local_units').select('id, display_name').in('id', manageableLocalUnitIds).returns<LocalUnitRow[]>()
      : Promise.resolve({ data: [] as LocalUnitRow[] }),
  ])

  const memberCounts = new Map<string, number>()
  for (const row of memberCountResult.data ?? []) {
    memberCounts.set(row.custom_list_id, (memberCounts.get(row.custom_list_id) ?? 0) + 1)
  }

  const accessCounts = new Map<string, number>()
  for (const row of accessCountResult.data ?? []) {
    accessCounts.set(row.custom_list_id, (accessCounts.get(row.custom_list_id) ?? 0) + 1)
  }

  const localUnitsById = new Map(((localUnitsResult.data ?? []) as LocalUnitRow[]).map((row) => [row.id, row] as const))
  const manageableUnits = (manageableUnitsResult.data ?? []) as LocalUnitRow[]

  const currentLocalUnitName =
    (activeManageLocalUnitId
      ? manageableUnits.find((row) => row.id === activeManageLocalUnitId)?.display_name ?? null
      : manageableLocalUnitIds.length === 1
        ? manageableUnits[0]?.display_name ?? null
        : null) ?? null

  const switchableLocalUnits = manageableUnits
    .filter((row) => row.id !== activeManageLocalUnitId)
    .sort((left, right) => (left.display_name ?? '').localeCompare(right.display_name ?? ''))
    .map((row) => ({
      local_unit_id: row.id,
      local_unit_name: row.display_name ?? 'Organization',
    }))

  const brandingLocalUnitId =
    activeManageLocalUnitId ??
    memberDirectoryLocalUnitId ??
    (listLocalUnitIds.length === 1 ? listLocalUnitIds[0] : null)

  const { localUnit: brandingLocalUnit, organization } = await loadOrganizationProfileForLocalUnit({
    admin,
    localUnitId: brandingLocalUnitId,
  })

  const organizationName = getEffectiveOrganizationName(organization) ?? brandingLocalUnit?.display_name ?? 'Organization'
  const effectiveBranding = getEffectiveOrganizationBranding(organization)

  const memberDirectoryData =
    showMemberDirectory && memberDirectoryLocalUnitId
      ? await loadLocalUnitMemberDirectoryData({
          admin,
          localUnitId: memberDirectoryLocalUnitId,
        })
      : null

  const memberDirectoryLocalUnitName =
    memberDirectoryLocalUnitId
      ? manageableUnits.find((row) => row.id === memberDirectoryLocalUnitId)?.display_name ??
        brandingLocalUnit?.display_name ??
        organizationName
      : null

  const memberDirectoryHref = showMemberDirectory ? '/custom-lists' : '/custom-lists?showMemberDirectory=1#member-directory-section'

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section
          style={{
            display: 'grid',
            gap: 14,
            paddingTop: 28,
            marginBottom: 18,
          }}
        >
          <h1
            className="qv-directory-name"
            style={{
              margin: 0,
              fontSize: 'clamp(42px, 6.4vw, 68px)',
              lineHeight: 0.96,
              letterSpacing: '-0.04em',
              whiteSpace: 'nowrap',
            }}
          >
            Custom Lists
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: '36ch',
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.35,
              color: 'var(--text-secondary)',
            }}
          >
            Create and manage custom follow-up lists for your local organization.
          </p>
        </section>

        <section className="qv-hero-card">
          <div style={{ display: 'grid', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 18,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'grid', gap: 12 }}>
                <h2 className="qv-section-title" style={{ margin: 0 }}>
                  {currentLocalUnitName ?? organizationName}
                </h2>

                {switchableLocalUnits.length > 0 && !permissions.isDevMode ? (
                  <details className="qv-view-menu">
                    <summary>
                      <span>Change local organization</span>
                      <span aria-hidden="true" className="qv-view-menu-chevron">
                        ▾
                      </span>
                    </summary>
                    <div className="qv-view-menu-panel">
                      {switchableLocalUnits.map((unit) => (
                        <form key={unit.local_unit_id} method="post" action="/account/parallel-area-context">
                          <input type="hidden" name="areaCode" value="custom_lists" />
                          <input type="hidden" name="minimumAccessLevel" value="manage" />
                          <input type="hidden" name="localUnitId" value={unit.local_unit_id} />
                          <input type="hidden" name="next" value="/custom-lists" />
                          <button
                            type="submit"
                            className="qv-view-menu-item"
                            style={{ width: '100%', justifyContent: 'flex-start' }}
                          >
                            {unit.local_unit_name}
                          </button>
                        </form>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>

              <div className="qv-org-avatar-wrap">
                <OrganizationAvatar
                  displayName={organizationName}
                  logoStoragePath={effectiveBranding.logo_storage_path}
                  logoAltText={effectiveBranding.logo_alt_text ?? organizationName}
                  size={72}
                />
              </div>
            </div>
          </div>
        </section>

        <SectionMenuBar
          items={[
            ...(permissions.canManageCustomLists && memberDirectoryLocalUnitId
              ? [{ label: showMemberDirectory ? 'Hide member directory' : 'Create custom list', href: memberDirectoryHref }]
              : []),
            { label: 'Archived lists', href: '/custom-lists/archive' },
          ]}
        />

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Saved lists</h2>
              <p className="qv-section-subtitle">
                Open a list to review members, notes, sharing, and follow-up activity.
              </p>
            </div>
          </div>

          {lists.length === 0 ? (
            <div className="qv-empty">
              <p className="qv-empty-title">No custom lists yet.</p>
              <p className="qv-empty-text">This organization does not have any custom lists yet.</p>
            </div>
          ) : (
            <div className="qv-member-list">
              {lists.map((list) => {
                const localUnitName = list.local_unit_id
                  ? localUnitsById.get(list.local_unit_id)?.display_name ?? 'Organization'
                  : 'Organization'

                return (
                  <Link key={list.id} href={`/custom-lists/${list.id}`} className="qv-member-link qv-card-link">
                    <article className="qv-member-row qv-custom-list-card">
                      <div className="qv-member-main">
                        <div className="qv-member-text">
                          <div className="qv-member-name">{list.name}</div>
                          <div className="qv-member-meta">{list.description || 'No description yet.'}</div>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
                            <span className="qv-member-meta">{localUnitName}</span>
                            <span className="qv-member-meta">Members: {memberCounts.get(list.id) ?? 0}</span>
                            <span className="qv-member-meta">Shared with: {accessCounts.get(list.id) ?? 0}</span>
                            <span className="qv-member-meta">Last updated: {formatDateTime(list.updated_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="qv-member-row-right">
                        <span className="qv-chevron">›</span>
                      </div>
                    </article>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {showMemberDirectory ? (
          <div id="member-directory-section" style={{ marginTop: 20 }}>
            {memberDirectoryData ? (
              <MembersList
                members={memberDirectoryData.members}
                currentOfficerLabelsById={memberDirectoryData.currentOfficerLabelsById}
                executiveOfficerLabelsById={memberDirectoryData.executiveOfficerLabelsById}
                sectionTitle="Member directory"
                sectionSubtitle={`Search, sort, and save a new custom list from ${memberDirectoryLocalUnitName ?? 'the current organization'}.`}
                currentViewControlMode="button"
              />
            ) : (
              <section className="qv-card">
                <div className="qv-empty">
                  <p className="qv-empty-title">Member directory is not available here yet.</p>
                  <p className="qv-empty-text">This local organization cannot load a reusable member directory right now.</p>
                </div>
              </section>
            )}
          </div>
        ) : null}
      </div>
    </main>
  )
}
