import Link from 'next/link';
import AppHeader from '@/app/app-header';
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context';
import { decryptPeopleRecords } from '@/lib/security/pii';

type ArchivedPersonRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  cell_phone: string | null;
  primary_relationship_code: string | null;
  archived_at: string | null;
  archive_reason: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function startCase(value: string | null) {
  if (!value) return 'Unknown';
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export default async function ArchivedMembersPage() {
  const { admin: supabase, council, localUnitId } = await getCurrentActingCouncilContext({
    redirectTo: '/members',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  });

  const memberIdsResult = localUnitId
    ? await supabase
        .from('member_records')
        .select('legacy_people_id')
        .eq('local_unit_id', localUnitId)
    : { data: [] as Array<{ legacy_people_id: string | null }>, error: null };

  const memberIdsError = memberIdsResult.error ?? null;
  const localUnitPersonIds = [
    ...new Set(
      (((memberIdsResult.data as Array<{ legacy_people_id: string | null }> | null) ?? [])
        .map((row) => row.legacy_people_id)
        .filter((value): value is string => Boolean(value)))
    ),
  ];

  const archivedPeopleResult =
    memberIdsError || localUnitPersonIds.length === 0
      ? { data: [] as ArchivedPersonRow[], error: memberIdsError }
      : await supabase
          .from('people')
          .select('id, first_name, last_name, email, cell_phone, primary_relationship_code, archived_at, archive_reason')
          .in('id', localUnitPersonIds)
          .not('archived_at', 'is', null)
          .order('archived_at', { ascending: false })
          .returns<ArchivedPersonRow[]>();

  const data = archivedPeopleResult.data ?? [];
  const error = archivedPeopleResult.error ?? null;
  const archivedPeople = decryptPeopleRecords(data);

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
              <h1 className="qv-title">Archived people</h1>
              <p className="qv-subtitle">People removed from the active local organization directory stay visible here for admins.</p>
            </div>

            <div className="qv-directory-actions">
              <Link href="/members" className="qv-link-button qv-button-secondary">
                Back to people
              </Link>
            </div>
          </div>
        </section>

        {error ? (
          <section className="qv-card qv-error">Could not load archived people. {error.message}</section>
        ) : archivedPeople.length === 0 ? (
          <section className="qv-card qv-empty">
            <h2 className="qv-empty-title">No archived people</h2>
            <p className="qv-empty-text">Removed people will appear here after they are archived from the directory.</p>
          </section>
        ) : (
          <section className="qv-card">
            <div className="qv-directory-section-head">
              <div>
                <h2 className="qv-section-title">Recently removed</h2>
                <p className="qv-section-subtitle">These records are out of the active directory but still available for reference.</p>
              </div>
            </div>

            <div className="qv-member-list">
              {archivedPeople.map((person) => (
                <div key={person.id} className="qv-member-row">
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div className="qv-member-name">{person.first_name} {person.last_name}</div>
                    <div className="qv-inline-message" style={{ color: 'var(--text-primary)' }}>
                      {startCase(person.primary_relationship_code)}
                    </div>
                    <div className="qv-inline-message" style={{ color: 'var(--text-primary)' }}>
                      {person.email || person.cell_phone || 'No contact information on file'}
                    </div>
                    <div className="qv-inline-message">Archived {formatDateTime(person.archived_at)}</div>
                    {person.archive_reason ? (
                      <div className="qv-inline-message">Reason: {person.archive_reason}</div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
