import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import MembersList from '@/app/members-list'
import OrganizationAvatar from '@/app/components/organization-avatar'
import SectionMenuBar from '@/app/components/section-menu-bar'
import { findCurrentActingCouncilContextForArea } from '@/lib/auth/acting-context'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { getSelectedOperationsLocalUnitId, OPERATIONS_SCOPE_COOKIE } from '@/lib/auth/operations-scope-selection'
import { listAccessibleLocalUnitsForArea } from '@/lib/auth/area-access'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  formatDateTime,
  listManageableLocalUnitIdsForCustomLists,
  listSharedCustomListIdsForUser,
  type CustomListRow,
} from '@/lib/custom-lists'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import { type OrganizationProfileRow } from '@/lib/organizations/profile'
import { loadCouncilMemberDirectoryData } from '@/lib/members/directory-data'

type CountRow = {
  custom_list_id: string
}

type OrganizationRow = OrganizationProfileRow

type CouncilContextRow = {
  id: string
  name: string | null
  council_number: string | null
  organization_id: string | null
}

type LocalUnitRow = {
  id: string
  display_name: string | null
}

type DirectoryLocalUnitRow = LocalUnitRow & {
  legacy_council_id: string | null
}

type ContextLocalUnitRow = DirectoryLocalUnitRow & {
  legacy_organization_id: string | null
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function normalizeSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

async function loadOrganizationProfile(args: {
  admin: ReturnType<typeof createAdminClient>
  council: CouncilContextRow
}) {
  const { admin, council } = args

  if (!council.organization_id) {
    return null
  }

  const { data } = await admin
    .from('organizations')
    .select(
      'display_name, preferred_name, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)'
    )
    .eq('id', council.organization_id)
    .maybeSingle()

  return (data as OrganizationRow | null) ?? null
}

async function renderManageCustomListsPage(args: {
  searchParams: Record<string, string | string[] | undefined>
  context: NonNullable<Awaited<ReturnType<typeof findCurrentActingCouncilContextForArea>>>
}) {
  const resolvedSearchParams = args.searchParams
  const showMemberDirectory = normalizeSingleParam(resolvedSearchParams.showMemberDirectory) === '1'
  const { admin, council, permissions, localUnitId } = args.context

  const organization = await loadOrganizationProfile({
    admin,
    council: {
      id: council.id,
      name: council.name,
      council_number: council.council_number,
      organization_id: council.organization_id,
    },
  })
  const organizationName = getEffectiveOrganizationName(organization) ?? council.name ?? 'Organization'
  const effectiveBranding = getEffectiveOrganizationBranding(organization)
  const currentCouncilLabel = `${council.name ?? organizationName}${council.council_number ? ` (${council.council_number})` : ''}`

  const switchableLocalUnits = permissions.authUser
    ? (
        await listAccessibleLocalUnitsForArea({
          admin,
          userId: permissions.authUser.id,
          areaCode: 'custom_lists',
          minimumAccessLevel: 'manage',
        })
      )
        .filter((unit) => unit.local_unit_id !== localUnitId)
        .sort((left, right) => left.local_unit_name.localeCompare(right.local_unit_name))
    : []

  const { data: listRows, error: listError } = await admin
    .from('custom_lists')
    .select('id, council_id, local_unit_id, name, description, archived_at, created_at, updated_at, created_by_auth_user_id, updated_by_auth_user_id')
    .eq('council_id', council.id)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .returns<CustomListRow[]>()

  if (listError) {
    throw new Error(`Could not load custom lists. ${listError.message}`)
  }

  const lists = listRows ?? []
  const listIds = lists.map((list) => list.id)

  const [memberCountResult, accessCountResult, memberDirectoryData] = await Promise.all([
    listIds.length > 0
      ? admin.from('custom_list_members').select('custom_list_id').in('custom_list_id', listIds).returns<CountRow[]>()
      : Promise.resolve({ data: [] as CountRow[] }),
    listIds.length > 0
      ? admin.from('custom_list_access').select('custom_list_id').in('custom_list_id', listIds).returns<CountRow[]>()
      : Promise.resolve({ data: [] as CountRow[] }),
    showMemberDirectory
      ? loadCouncilMemberDirectoryData({ admin, councilId: council.id })
      : Promise.resolve(null),
  ])

  const memberCounts = new Map<string, number>()
  for (const row of memberCountResult.data ?? []) {
    memberCounts.set(row.custom_list_id, (memberCounts.get(row.custom_list_id) ?? 0) + 1)
  }

  const accessCounts = new Map<string, number>()
  for (const row of accessCountResult.data ?? []) {
    accessCounts.set(row.custom_list_id, (accessCounts.get(row.custom_list_id) ?? 0) + 1)
  }

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
            Create and manage custom follow-up lists for your council.
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
                  {currentCouncilLabel}
                </h2>

                {switchableLocalUnits.length > 0 ? (
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
            { label: showMemberDirectory ? 'Hide member directory' : 'Create custom list', href: memberDirectoryHref },
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
              <p className="qv-empty-text">This council does not have any custom lists yet.</p>
            </div>
          ) : (
            <div className="qv-member-list">
              {lists.map((list) => (
                <Link key={list.id} href={`/custom-lists/${list.id}`} className="qv-member-link qv-card-link">
                  <article className="qv-member-row qv-custom-list-card">
                    <div className="qv-member-main">
                      <div className="qv-member-text">
                        <div className="qv-member-name">{list.name}</div>
                        <div className="qv-member-meta">{list.description || 'No description yet.'}</div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
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
              ))}
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
                sectionSubtitle={`Search, sort, and save a new custom list from ${currentCouncilLabel}.`}
                currentViewControlMode="button"
              />
            ) : (
              <section className="qv-card">
                <div className="qv-empty">
                  <p className="qv-empty-title">Member directory is not available here yet.</p>
                  <p className="qv-empty-text">This council cannot load a reusable member directory right now.</p>
                </div>
              </section>
            )}
          </div>
        ) : null}
      </div>
    </main>
  )
}

export default async function CustomListsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser) {
    redirect('/login')
  }

  const manageContext = await findCurrentActingCouncilContextForArea({
    areaCode: 'custom_lists',
    minimumAccessLevel: 'manage',
  })

  if (manageContext) {
    return renderManageCustomListsPage({ searchParams: resolvedSearchParams, context: manageContext })
  }

  const showMemberDirectory = normalizeSingleParam(resolvedSearchParams.showMemberDirectory) === '1'
  const admin = createAdminClient()

  const cookieStore = await cookies()
  const selectedLocalUnitId = getSelectedOperationsLocalUnitId({
    rawCookieValue: cookieStore.get(OPERATIONS_SCOPE_COOKIE)?.value ?? null,
  })

  const [manageableLocalUnitIds, sharedIds, legacyContextLocalUnitId, organizationLocalUnitIds] = await Promise.all([
    listManageableLocalUnitIdsForCustomLists({ admin, permissions }),
    listSharedCustomListIdsForUser({ admin, permissions }),
    permissions.councilId
      ? admin
          .from('local_units')
          .select('id')
          .eq('legacy_council_id', permissions.councilId)
          .limit(1)
          .maybeSingle<{ id: string }>()
          .then((result) => result.data?.id ?? null)
      : Promise.resolve(null),
    permissions.organizationId
      ? admin
          .from('local_units')
          .select('id')
          .eq('legacy_organization_id', permissions.organizationId)
          .then((result) => ((result.data as Array<{ id: string }> | null) ?? []).map((row) => row.id))
      : Promise.resolve([] as string[]),
  ])

  const activeLocalUnitId =
    (selectedLocalUnitId && manageableLocalUnitIds.includes(selectedLocalUnitId) ? selectedLocalUnitId : null) ??
    legacyContextLocalUnitId ??
    (manageableLocalUnitIds.length === 1 ? manageableLocalUnitIds[0] : null)

  if (manageableLocalUnitIds.length === 0 && sharedIds.length === 0) {
    redirect('/me')
  }

  const contextScopedManageableLocalUnitIds =
    activeLocalUnitId || organizationLocalUnitIds.length === 0
      ? manageableLocalUnitIds
      : manageableLocalUnitIds.filter((value) => organizationLocalUnitIds.includes(value))

  const scopedManageableLocalUnitIds =
    activeLocalUnitId && manageableLocalUnitIds.includes(activeLocalUnitId)
      ? [activeLocalUnitId]
      : activeLocalUnitId
        ? []
        : contextScopedManageableLocalUnitIds

  const memberDirectoryLocalUnitId =
    permissions.canManageCustomLists && contextScopedManageableLocalUnitIds.length > 0
      ? activeLocalUnitId && manageableLocalUnitIds.includes(activeLocalUnitId)
        ? activeLocalUnitId
        : contextScopedManageableLocalUnitIds.length === 1
          ? contextScopedManageableLocalUnitIds[0]
          : null
      : null

  let query = admin
    .from('custom_lists')
    .select('id, council_id, local_unit_id, name, description, archived_at, created_at, updated_at, created_by_auth_user_id, updated_by_auth_user_id')
    .is('archived_at', null)
    .order('updated_at', { ascending: false })

  const filters: string[] = []

  if (activeLocalUnitId && manageableLocalUnitIds.includes(activeLocalUnitId)) {
    filters.push(`local_unit_id.eq.${activeLocalUnitId}`)
  } else if (scopedManageableLocalUnitIds.length > 0) {
    filters.push(`local_unit_id.in.(${scopedManageableLocalUnitIds.join(',')})`)
  } else if (sharedIds.length === 0 && permissions.councilId) {
    filters.push(`council_id.eq.${permissions.councilId}`)
  }

  if (sharedIds.length > 0) {
    filters.push(`id.in.(${sharedIds.join(',')})`)
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
  const localUnitIds = [...new Set(lists.map((list) => list.local_unit_id).filter((value): value is string => Boolean(value)))]
  const contextLocalUnitIds = [...new Set([
    ...contextScopedManageableLocalUnitIds,
    ...(activeLocalUnitId ? [activeLocalUnitId] : []),
  ])]

  const [
    memberCountResult,
    accessCountResult,
    localUnitsResult,
    contextLocalUnitsResult,
    activeContextUnitResult,
  ] = await Promise.all([
    listIds.length > 0
      ? admin.from('custom_list_members').select('custom_list_id').in('custom_list_id', listIds).returns<CountRow[]>()
      : Promise.resolve({ data: [] as CountRow[] }),
    listIds.length > 0
      ? admin.from('custom_list_access').select('custom_list_id').in('custom_list_id', listIds).returns<CountRow[]>()
      : Promise.resolve({ data: [] as CountRow[] }),
    localUnitIds.length > 0
      ? admin.from('local_units').select('id, display_name').in('id', localUnitIds).returns<LocalUnitRow[]>()
      : Promise.resolve({ data: [] as LocalUnitRow[] }),
    contextLocalUnitIds.length > 0
      ? admin
          .from('local_units')
          .select('id, display_name')
          .in('id', contextLocalUnitIds)
          .returns<LocalUnitRow[]>()
      : Promise.resolve({ data: [] as LocalUnitRow[] }),
    activeLocalUnitId
      ? admin
          .from('local_units')
          .select('id, display_name, legacy_council_id, legacy_organization_id')
          .eq('id', activeLocalUnitId)
          .maybeSingle<ContextLocalUnitRow>()
      : Promise.resolve({ data: null as ContextLocalUnitRow | null }),
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
  const contextLocalUnits = (contextLocalUnitsResult.data ?? []) as LocalUnitRow[]
  const currentLocalUnitName =
    (activeLocalUnitId ? contextLocalUnits.find((row) => row.id === activeLocalUnitId)?.display_name ?? null : null) ?? null
  const switchableLocalUnits = contextLocalUnits
    .filter((row) => row.id !== activeLocalUnitId)
    .sort((left, right) => (left.display_name ?? '').localeCompare(right.display_name ?? ''))
    .map((row) => ({
      local_unit_id: row.id,
      local_unit_name: row.display_name ?? 'Organization',
    }))

  const activeContextUnit = (activeContextUnitResult.data as ContextLocalUnitRow | null) ?? null
  const contextCouncilId = activeContextUnit?.legacy_council_id ?? permissions.councilId ?? null
  const { data: councilData } =
    contextCouncilId
      ? await admin
          .from('councils')
          .select('id, name, council_number, organization_id')
          .eq('id', contextCouncilId)
          .maybeSingle<CouncilContextRow>()
      : { data: null }

  const organization = councilData
    ? await loadOrganizationProfile({
        admin,
        council: councilData,
      })
    : null
  const organizationName = getEffectiveOrganizationName(organization)
  const effectiveBranding = getEffectiveOrganizationBranding(organization)

  let memberDirectoryData: Awaited<ReturnType<typeof loadCouncilMemberDirectoryData>> | null = null
  let memberDirectoryLocalUnitName: string | null = null

  if (showMemberDirectory && memberDirectoryLocalUnitId) {
    const { data: directoryUnit, error: directoryUnitError } = await admin
      .from('local_units')
      .select('id, display_name, legacy_council_id')
      .eq('id', memberDirectoryLocalUnitId)
      .maybeSingle<DirectoryLocalUnitRow>()

    if (directoryUnitError) {
      throw new Error(`Could not load member directory context. ${directoryUnitError.message}`)
    }

    if (directoryUnit?.legacy_council_id) {
      memberDirectoryData = await loadCouncilMemberDirectoryData({
        admin,
        councilId: directoryUnit.legacy_council_id,
      })
      memberDirectoryLocalUnitName = directoryUnit.display_name ?? organizationName ?? 'this organization'
    }
  }

  const memberDirectoryHref = showMemberDirectory ? '/custom-lists' : '/custom-lists?showMemberDirectory=1#member-directory-section'
  const archiveHref = '/custom-lists/archive'

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              <p className="qv-eyebrow">{currentLocalUnitName ?? organizationName ?? 'Custom lists'}</p>
              <h1 className="qv-title">Custom lists</h1>
              <p className="qv-subtitle">Lists you can manage directly or that have been shared with you.</p>
              {switchableLocalUnits.length > 0 ? (
                <details className="qv-view-menu" style={{ marginTop: 12 }}>
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
                displayName={organizationName ?? 'Organization'}
                logoStoragePath={effectiveBranding.logo_storage_path}
                logoAltText={effectiveBranding.logo_alt_text ?? organizationName ?? 'Organization'}
                size={72}
              />
            </div>
          </div>
        </section>

        <div className="qv-section-menu-shell">
          <div className="qv-section-menu-desktop" aria-label="Custom list actions">
            {permissions.canManageCustomLists && memberDirectoryLocalUnitId ? (
              <Link href={memberDirectoryHref} className="qv-section-menu-link">
                {showMemberDirectory ? 'Hide member directory' : 'Create custom list'}
              </Link>
            ) : null}
            <Link href={archiveHref} className="qv-section-menu-link">
              View archive
            </Link>
          </div>
        </div>

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Saved lists</h2>
              <p className="qv-section-subtitle">Open a list to review members, notes, sharing, and follow-up activity.</p>
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
                const localUnitName = list.local_unit_id ? localUnitsById.get(list.local_unit_id)?.display_name ?? 'Organization' : 'Organization'
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
                  <p className="qv-empty-text">This organization context cannot load a reusable member directory right now.</p>
                </div>
              </section>
            )}
          </div>
        ) : null}
      </div>
    </main>
  )
}
