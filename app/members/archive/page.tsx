import Link from 'next/link'
import AppHeader from '@/app/app-header'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { decryptPeopleRecords } from '@/lib/security/pii'

type ArchivedMemberRow = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  cell_phone: string | null
  archived_at: string | null
  archive_reason: string | null
}

function formatDateTime(value: string | null) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export default async function ArchivedMembersPage() {
  const { admin: supabase, council } = await getCurrentActingCouncilContext({ redirectTo: '/members' })

  const { data, error } = await supabase
    .from('people')
    .select('id, first_name, last_name, email, cell_phone, archived_at, archive_reason')
    .eq('council_id', council.id)
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })
    .returns<ArchivedMemberRow[]>()

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-hero-top">
            <div>
              <p className="qv-eyebrow">
                {council.name ?? 'Council'}
                {council.council_number ? ` (${council.council_number})` : ''}
              </p>
              <h1 className="qv-title">Archived members</h1>
              <p className="qv-subtitle">Members removed from the active directory stay visible here for admins.</p>
            </div>

            <div className="qv-directory-actions">
              <Link href="/members" className="qv-link-button qv-button-secondary">
                Back to members
              </Link>
            </div>
          </div>
        </section>

        {error ? (
          <section className="qv-card qv-error">Could not load archived members. {error.message}</section>
        ) : decryptPeopleRecords(data ?? []).length === 0 ? (
          <section className="qv-card qv-empty">
            <h2 className="qv-empty-title">No archived members</h2>
            <p className="qv-empty-text">Removed members will appear here after they are archived from the directory.</p>
          </section>
        ) : (
          <section className="qv-card">
            <div className="qv-directory-section-head">
              <div>
                <h2 className="qv-section-title">Recently removed</h2>
                <p className="qv-section-subtitle">These records are out of the active member list but still available for reference.</p>
              </div>
            </div>

            <div className="qv-member-list">
              {decryptPeopleRecords(data ?? []).map((member) => (
                <div key={member.id} className="qv-member-row">
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div className="qv-member-name">{member.first_name} {member.last_name}</div>
                    <div className="qv-inline-message" style={{ color: 'var(--text-primary)' }}>
                      {member.email || member.cell_phone || 'No contact information on file'}
                    </div>
                    <div className="qv-inline-message">Archived {formatDateTime(member.archived_at)}</div>
                    {member.archive_reason ? (
                      <div className="qv-inline-message">Reason: {member.archive_reason}</div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
