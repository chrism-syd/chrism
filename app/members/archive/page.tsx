import Link from 'next/link';
import AppHeader from '@/app/app-header';
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context';
import { restoreMemberAction } from '../actions';
import { decryptPeopleRecords } from '@/lib/security/pii';

type ArchivedMemberRecordRow = {
  id: string;
  legacy_people_id: string | null;
  archived_at: string | null;
  lifecycle_state: string | null;
};

type ArchivedPersonRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  cell_phone: string | null;
  primary_relationship_code: string | null;
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
  if (value === 'volunteer_only') return 'Volunteer';
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export default async function ArchivedMembersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage =
    typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : null;

  const { admin: supabase, council, localUnitId } = await getCurrentActingCouncilContext({
    redirectTo: '/members',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  });

  const archivedMemberRecordsResult = localUnitId
    ? await supabase
        .from('member_records')
        .select('id, legacy_people_id, archived_at, lifecycle_state')
        .eq('local_unit_id', localUnitId)
        .eq('lifecycle_state', 'archived')
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })
        .returns<ArchivedMemberRecordRow[]>()
    : { data: [] as ArchivedMemberRecordRow[], error: null };

  const error = archivedMemberRecordsResult.error ?? null;
  const archivedMemberRecords = archivedMemberRecordsResult.data ?? [];

  const archivedPersonIds = [
    ...new Set(
      archivedMemberRecords
        .map((row) => row.legacy_people_id)
        .filter((value): value is string => Boolean(value))
    ),
  ];

  const archivedPeopleResult =
    error || archivedPersonIds.length === 0
      ? { data: [] as ArchivedPersonRow[], error: error }
      : await supabase
          .from('people')
          .select('id, first_name, last_name, email, cell_phone, primary_relationship_code')
          .in('id', archivedPersonIds)
          .returns<ArchivedPersonRow[]>();

  const archivedPeople = decryptPeopleRecords(archivedPeopleResult.data ?? []);
  const archivedPeopleById = new Map(archivedPeople.map((person) => [person.id, person]));
  const archivedEntries = archivedMemberRecords
    .map((memberRecord) => ({
      memberRecord,
      person: memberRecord.legacy_people_id
        ? archivedPeopleById.get(memberRecord.legacy_people_id) ?? null
        : null,
    }))
    .filter((entry) => entry.person);

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

        {errorMessage ? (
          <section className="qv-card qv-error">{errorMessage}</section>
        ) : null}

        {error ? (
          <section className="qv-card qv-error">Could not load archived people. {error.message}</section>
        ) : archivedEntries.length === 0 ? (
          <section className="qv-card qv-empty">
            <h2 className="qv-empty-title">No archived people</h2>
            <p className="qv-empty-text">Removed people will appear here after they are archived from the active local organization directory.</p>
          </section>
        ) : (
          <section className="qv-card">
            <div className="qv-directory-section-head">
              <div>
                <h2 className="qv-section-title">Recently removed</h2>
                <p className="qv-section-subtitle">These records are out of the active directory for this local organization but still available for reference.</p>
              </div>
            </div>

            <div className="qv-member-list">
              {archivedEntries.map(({ memberRecord, person }) => (
                <div key={memberRecord.id} className="qv-member-row">
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div className="qv-member-name">{person!.first_name} {person!.last_name}</div>
                    <div className="qv-inline-message" style={{ color: 'var(--text-primary)' }}>
                      {startCase(person!.primary_relationship_code)}
                    </div>
                    <div className="qv-inline-message" style={{ color: 'var(--text-primary)' }}>
                      {person!.email || person!.cell_phone || 'No contact information on file'}
                    </div>
                    <div className="qv-inline-message">Archived {formatDateTime(memberRecord.archived_at)}</div>
                  </div>

                  <div className="qv-member-row-right">
                    <form action={restoreMemberAction}>
                      <input type="hidden" name="member_id" value={person!.id} />
                      <button type="submit" className="qv-link-button qv-button-secondary">
                        Restore
                      </button>
                    </form>
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
