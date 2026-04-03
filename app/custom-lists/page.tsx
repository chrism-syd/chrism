import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import MembersList from '@/app/members-list'
import OrganizationAvatar from '@/app/components/organization-avatar'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { getSelectedLocalUnitIdForArea, PARALLEL_AREA_SELECTION_COOKIE } from '@/lib/auth/parallel-area-selection'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  formatDateTime,
  listManageableLocalUnitIdsForCustomLists,
  listSharedCustomListIdsForUser,
  type CustomListRow,
} from '@/lib/custom-lists'
import { getEffectiveOrganizationName } from '@/lib/organizations/names'
import { loadCouncilMemberDirectoryData } from '@/lib/members/directory-data'

type CountRow = {
  custom_list_id: string
}

type OrganizationRow = {
  display_name: string | null
  preferred_name: string | null
  logo_storage_path: string | null
  logo_alt_text: string | null
}

type LocalUnitRow = {
  id: string
  display_name: string | null
}

type DirectoryLocalUnitRow = LocalUnitRow & {
  legacy_council_id: string | null
}

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function normalizeSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
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
  const selectedLocalUnitId = getSelectedLocalUnitIdForArea({
    rawCookieValue: cookieStore.get(PARALLEL_AREA_SELECTION_COOKIE)?.value ?? null,
    areaCode: 'custom_lists',
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
      : manageableLocalUnitIds.filter((localUnitId) => organizationLocalUnitIds.includes(localUnitId))

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

  if (activeLocalUnitId) {
    query = query.eq('local_unit_id', activeLocalUnitId)
  } else if (organizationLocalUnitIds.length > 0) {
    query = query.in('local_unit_id', organizationLocalUnitIds)
  } else if (permissions.councilId) {
    query = query.eq('council_id', permissions.councilId)
  }

  const filters: string[] = []
  if (scopedManageableLocalUnitIds.length > 0) {
    filters.push(`local_unit_id.in.(${scopedManageableLocalUnitIds.join(',')})`)
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

  const [organizationResult, memberCountResult, accessCountResult, localUnitsResult] = await Promise.all([
    permissions.organizationId
      ? admin
          .from('organizations')
          .select('display_name, preferred_name, logo_storage_path, logo_alt_text')
          .eq('id', permissions.organizationId)
          .maybeSingle<OrganizationRow>()
      : Promise.resolve({ data: null as OrganizationRow | null }),
    listIds.length > 0
      ? admin.from('custom_list_members').select('custom_list_id').in('custom_list_id', listIds).returns<CountRow[]>()
      : Promise.resolve({ data: [] as CountRow[] }),
    listIds.length > 0
      ? admin.from('custom_list_access').select('custom_list_id').in('custom_list_id', listIds).returns<CountRow[]>()
      : Promise.resolve({ data: [] as CountRow[] }),
    localUnitIds.length > 0
      ? admin.from('local_units').select('id, display_name').in('id', localUnitIds).returns<LocalUnitRow[]>()
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
  const organizationName = getEffectiveOrganizationName((organizationResult as { data: OrganizationRow | null }).data ?? null)

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
              <p className="qv-eyebrow">{organizationName ?? 'Custom lists'}</p>
              <h1 className="qv-title">Custom lists</h1>
              <p className="qv-subtitle">
                Lists you can manage directly or that have been shared with you.
              </p>
            </div>
            <div className="qv-org-avatar-wrap">
              <OrganizationAvatar
                displayName={organizationName ?? 'Organization'}
                logoStoragePath={(organizationResult as { data: OrganizationRow | null }).data?.logo_storage_path ?? null}
                logoAltText={(organizationResult as { data: OrganizationRow | null }).data?.logo_alt_text ?? organizationName ?? 'Organization'}
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
              <p className="qv-section-subtitle">
                Open a list to review members, notes, sharing, and follow-up activity.
              </p>
            </div>
          </div>

          {lists.length === 0 ? (
            <div className="qv-empty">
              <p className="qv-empty-title">No custom lists yet.</p>
              <p className="qv-empty-text">
                This organization does not have any custom lists yet.
              </p>
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
                  <p className="qv-empty-text">
                    This organization context cannot load a reusable member directory right now.
                  </p>
                </div>
              </section>
            )}
          </div>
        ) : null}
      </div>
    </main>
  )
}
