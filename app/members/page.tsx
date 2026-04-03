import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import MemberRowCard from '@/app/members/member-row-card'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { decryptPeopleRecords } from '@/lib/security/pii'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PersonRow = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  nickname: string | null
  primary_relationship_code: string | null
}

export default async function MembersPage() {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.canAccessMemberData) {
    redirect('/me')
  }

  const admin = createAdminClient()
  const context = await getCurrentActingCouncilContext({
    permissions,
    supabaseAdmin: admin,
    requireAdmin: false,
    redirectTo: '/me',
    requireArea: { area: 'members', level: 'edit_manage' },
  })

  const { data } = await admin
    .from('people')
    .select('id, first_name, last_name, email, nickname, primary_relationship_code')
    .eq('council_id', context.council.id)
    .is('archived_at', null)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })

  const members = decryptPeopleRecords((data as PersonRow[] | null) ?? []) as PersonRow[]

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <p className="qv-eyebrow">Members</p>
          <h1 className="qv-title">Directory for {context.council.name}</h1>
          <p className="qv-subtitle">
            Browse members, open profiles, and manage outreach lists.
          </p>
          <div className="qv-form-actions" style={{ marginTop: 20 }}>
            <Link href="/members/officers" className="qv-link-button qv-button-secondary">
              Officer directory
            </Link>
            <Link href="/custom-lists" className="qv-link-button qv-button-secondary">
              Custom lists
            </Link>
          </div>
        </section>

        <section className="qv-card" style={{ marginTop: 24 }}>
          {members.length === 0 ? (
            <div className="qv-empty">
              <p className="qv-empty-text">No members are available for this council yet.</p>
            </div>
          ) : (
            <div className="qv-member-list">
              {members.map((member) => (
                <MemberRowCard key={member.id} member={member} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
