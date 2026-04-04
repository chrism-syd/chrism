import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { updateCustomListDetailsAction } from '@/app/custom-lists/actions'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { hasStrictCustomListLifecycleAccess, type CustomListRow } from '@/lib/custom-lists'
import { createAdminClient } from '@/lib/supabase/admin'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function EditCustomListPage({ params }: PageProps) {
  const { id } = await params
  const permissions = await getCurrentUserPermissions()

  if (!permissions.authUser) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const { data: listData, error: listError } = await admin
    .from('custom_lists')
    .select('id, council_id, local_unit_id, name, description, archived_at, created_at, updated_at, created_by_auth_user_id, updated_by_auth_user_id')
    .eq('id', id)
    .maybeSingle<CustomListRow>()

  if (listError) {
    throw new Error(`Could not load this custom list. ${listError.message}`)
  }

  if (!listData || listData.archived_at) {
    notFound()
  }

  const canManageLifecycle = await hasStrictCustomListLifecycleAccess({
    admin,
    permissions,
    list: listData,
  })

  if (!canManageLifecycle) {
    redirect('/me')
  }

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section style={{ display: 'grid', gap: 14, marginTop: 12, marginBottom: 18 }}>
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
            Edit Custom List
          </h1>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, lineHeight: 1.35, color: 'var(--text-secondary)' }}>
            Update the name and description for this custom list.
          </p>
        </section>

        <section className="qv-card">
          <form action={updateCustomListDetailsAction} className="qv-form-grid">
            <input type="hidden" name="custom_list_id" value={listData.id} />

            <div className="qv-form-row">
              <div className="qv-control">
                <label className="qv-label" htmlFor="name">
                  List name
                </label>
                <input id="name" name="name" defaultValue={listData.name} required />
              </div>
            </div>

            <div className="qv-form-row">
              <div className="qv-control">
                <label className="qv-label" htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  defaultValue={listData.description ?? ''}
                  rows={4}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>

            <div className="qv-form-actions">
              <Link href={`/custom-lists/${listData.id}`} className="qv-button-secondary qv-link-button">
                Cancel
              </Link>
              <button type="submit" className="qv-button-primary">
                Save changes
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}
