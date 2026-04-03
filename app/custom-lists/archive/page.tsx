import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import ConfirmActionButton from '@/app/components/confirm-action-button'
import { deleteCustomListAction, restoreCustomListAction } from '@/app/custom-lists/actions'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import {
  formatDateTime,
  hasStrictCustomListLifecycleAccess,
  listManageableLocalUnitIdsForCustomLists,
  listSharedCustomListIdsForUser,
  type CustomListRow,
} from '@/lib/custom-lists'
import { createAdminClient } from '@/lib/supabase/admin'

type CountRow = {
  custom_list_id: string
}

type LocalUnitRow = {
  id: string
  display_name: string | null
}

export default async function ArchivedCustomListsPage() {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const [manageableLocalUnitIds, sharedIds] = await Promise.all([
    listManageableLocalUnitIdsForCustomLists({ admin, permissions }),
    listSharedCustomListIdsForUser({ admin, permissions }),
  ])

  if (manageableLocalUnitIds.length === 0 && sharedIds.length === 0) {
    redirect('/me')
  }

  let query = admin
    .from('custom_lists')
    .select('id, council_id, local_unit_id, name, description, archived_at, created_at, updated_at, created_by_auth_user_id, updated_by_auth_user_id')
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })

  const filters: string[] = []
  if (manageableLocalUnitIds.length > 0) {
    filters.push(`local_unit_id.in.(${manageableLocalUnitIds.join(',')})`)
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
    throw new Error(`Could not load archived custom lists. ${listError.message}`)
  }

  const visibleLists: CustomListRow[] = []
  for (const list of listRows ?? []) {
    if (
      await hasStrictCustomListLifecycleAccess({
        admin,
        permissions,
        list,
      })
    ) {
      visibleLists.push(list)
    }
  }

  const listIds = visibleLists.map((list) => list.id)
  const localUnitIds = [...new Set(visibleLists.map((list) => list.local_unit_id).filter((value): value is string => Boolean(value)))]

  const [memberCountResult, accessCountResult, localUnitsResult] = await Promise.all([
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

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              <p className="qv-eyebrow">Custom lists archive</p>
              <h1 className="qv-title">Archived custom lists</h1>
              <p className="qv-subtitle">
                Archived lists stay here until a local-unit manager restores them or deletes them permanently.
              </p>
            </div>
          </div>
        </section>

        <section className="qv-card" style={{ marginTop: 20 }}>
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Archived lists</h2>
              <p className="qv-section-subtitle">
                Restoring brings a list back to the active custom-lists view. Deleting it permanently removes the list, its members, and its sharing rows.
              </p>
            </div>
            <Link href="/custom-lists" className="qv-link-button qv-button-secondary">
              Back to active lists
            </Link>
          </div>

          {visibleLists.length === 0 ? (
            <div className="qv-empty">
              <p className="qv-empty-title">No archived custom lists.</p>
              <p className="qv-empty-text">Once a list is archived, it will show up here until you restore it or delete it permanently.</p>
            </div>
          ) : (
            <div className="qv-member-list">
              {visibleLists.map((list) => {
                const localUnitName = list.local_unit_id ? localUnitsById.get(list.local_unit_id)?.display_name ?? 'Organization' : 'Organization'
                return (
                  <article key={list.id} className="qv-member-row qv-custom-list-card" style={{ alignItems: 'flex-start' }}>
                    <div className="qv-member-main">
                      <div className="qv-member-text">
                        <div className="qv-member-name">{list.name}</div>
                        <div className="qv-member-meta">{list.description || 'No description saved.'}</div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
                          <span className="qv-member-meta">{localUnitName}</span>
                          <span className="qv-member-meta">Members: {memberCounts.get(list.id) ?? 0}</span>
                          <span className="qv-member-meta">Shared with: {accessCounts.get(list.id) ?? 0}</span>
                          <span className="qv-member-meta">Archived: {formatDateTime(list.archived_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="qv-detail-actions" style={{ marginTop: 0 }}>
                      <ConfirmActionButton
                        action={restoreCustomListAction}
                        hiddenFields={[{ name: 'custom_list_id', value: list.id }]}
                        triggerLabel="Restore"
                        confirmTitle="Restore this custom list?"
                        confirmDescription="This will bring the list back into the active custom-lists area with its members and sharing intact."
                        confirmLabel="Restore list"
                      />
                      <ConfirmActionButton
                        action={deleteCustomListAction}
                        hiddenFields={[{ name: 'custom_list_id', value: list.id }]}
                        triggerLabel="Delete permanently"
                        confirmTitle="Delete this custom list permanently?"
                        confirmDescription="This cannot be undone. The list, its member rows, and its sharing rows will be removed permanently."
                        confirmLabel="Delete permanently"
                        danger
                      />
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
