import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { getOrganizationAdminManagerAccess } from '@/lib/organizations/admin-managers'
import { protectPeoplePayload } from '@/lib/security/pii'
import { normalizeClaimText } from '@/lib/organizations/claim-requests'
import Link from 'next/link'

async function updateAdminProfileAction(formData: FormData) {
  'use server'

  const permissions = await getCurrentUserPermissions()
  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const personId = normalizeClaimText(formData.get('person_id') as string | null)
  const firstName = normalizeClaimText(formData.get('first_name') as string | null)
  const lastName = normalizeClaimText(formData.get('last_name') as string | null)
  const nickname = normalizeClaimText(formData.get('nickname') as string | null)
  const email = normalizeClaimText(formData.get('email') as string | null)

  if (!personId || !firstName || !lastName) {
    redirect('/me/council?error=Missing%20admin%20profile%20details.')
  }

  const context = await getCurrentActingCouncilContext({
    permissions,
    supabaseAdmin: admin,
    requireAdmin: false,
    redirectTo: '/me',
  })

  const adminManagerAccess = await getOrganizationAdminManagerAccess({
    permissions,
    councilId: context.council.id,
  })

  if (!adminManagerAccess.canManageAdmins) {
    redirect('/me')
  }

  const payload = protectPeoplePayload({
    first_name: firstName,
    last_name: lastName,
    nickname,
    email,
    updated_by_auth_user_id: permissions.authUser?.id ?? null,
  })

  const { error } = await admin.from('people').update(payload).eq('id', personId)
  if (error) {
    redirect(`/me/council?error=${encodeURIComponent(error.message)}`)
  }

  redirect('/me/council')
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CouncilAdminDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const permissions = await getCurrentUserPermissions()
  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  const admin = createAdminClient()
  const context = await getCurrentActingCouncilContext({
    permissions,
    supabaseAdmin: admin,
    requireAdmin: false,
    redirectTo: '/me',
  })

  const adminManagerAccess = await getOrganizationAdminManagerAccess({
    permissions,
    councilId: context.council.id,
  })

  if (!adminManagerAccess.canManageAdmins) {
    redirect('/me')
  }

  const { data: person } = await admin
    .from('people')
    .select('id, first_name, last_name, nickname, email')
    .eq('id', id)
    .maybeSingle<{
      id: string
      first_name: string
      last_name: string
      nickname: string | null
      email: string | null
    }>()

  if (!person) {
    redirect('/me/council')
  }

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <p className="qv-eyebrow">Organization admin</p>
          <h1 className="qv-title">{person.nickname?.trim() || `${person.first_name} ${person.last_name}`.trim()}</h1>
          <p className="qv-subtitle">Update the internal profile details for this organization admin.</p>
          <div className="qv-form-actions" style={{ marginTop: 20 }}>
            <Link href="/me/council" className="qv-link-button qv-button-secondary">
              Back to organization settings
            </Link>
          </div>
        </section>

        <section className="qv-card" style={{ marginTop: 24 }}>
          <form action={updateAdminProfileAction} className="qv-form-grid">
            <input type="hidden" name="person_id" value={person.id} />

            <div className="qv-form-row qv-form-row-2">
              <label className="qv-control">
                <span className="qv-label">First name</span>
                <input name="first_name" defaultValue={person.first_name} required />
              </label>
              <label className="qv-control">
                <span className="qv-label">Last name</span>
                <input name="last_name" defaultValue={person.last_name} required />
              </label>
            </div>

            <div className="qv-form-row qv-form-row-2">
              <label className="qv-control">
                <span className="qv-label">Preferred name</span>
                <input name="nickname" defaultValue={person.nickname ?? ''} />
              </label>
              <label className="qv-control">
                <span className="qv-label">Email</span>
                <input name="email" type="email" defaultValue={person.email ?? ''} />
              </label>
            </div>

            <div className="qv-form-actions">
              <button type="submit" className="qv-button-primary">
                Save admin profile
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}
