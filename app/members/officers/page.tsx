import Link from 'next/link';
import AppHeader from '@/app/app-header';
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context';
import { formatHonorificLabel, formatOfficerLabel, type OfficerScopeCode } from '@/lib/members/officer-roles';
import { getOrganizationContextLabel, type OrganizationNameRecord } from '@/lib/organizations/names';
import { decryptPeopleRecords } from '@/lib/security/pii';

type OfficerTermRow = {
  id: string;
  person_id: string;
  office_scope_code: OfficerScopeCode;
  office_code: string;
  office_rank: number | null;
  service_start_year: number;
  service_end_year: number | null;
};

type PersonRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
};

function personName(person: PersonRow) {
  return `${person.first_name} ${person.last_name}`.trim();
}

function formatTermRange(startYear: number, endYear: number | null) {
  if (endYear == null || endYear === startYear) {
    return `${startYear}`;
  }

  return `${startYear} to ${endYear}`;
}

type HonorificGroupRow = {
  person_id: string;
  label: string;
  start_year: number;
  end_year: number;
};

function buildHonorificGroups(terms: OfficerTermRow[]) {
  const grouped = new Map<string, Array<{ start: number; end: number }>>();

  for (const term of terms) {
    const label = formatHonorificLabel({
      scope: term.office_scope_code,
      code: term.office_code,
      endYear: term.service_end_year,
    });

    if (!label || term.service_end_year == null) {
      continue;
    }

    const key = `${term.person_id}::${label}`;
    const existing = grouped.get(key) ?? [];
    existing.push({ start: term.service_start_year, end: term.service_end_year });
    grouped.set(key, existing);
  }

  const rows: HonorificGroupRow[] = [];

  for (const [key, ranges] of grouped.entries()) {
    const [personId, label] = key.split('::');
    const sorted = [...ranges].sort((left, right) => left.start - right.start || left.end - right.end);
    let current = sorted[0];

    for (const next of sorted.slice(1)) {
      if (next.start <= current.end + 1) {
        current = { start: current.start, end: Math.max(current.end, next.end) };
        continue;
      }

      rows.push({ person_id: personId, label, start_year: current.start, end_year: current.end });
      current = next;
    }

    rows.push({ person_id: personId, label, start_year: current.start, end_year: current.end });
  }

  return rows.sort((left, right) => {
    if (left.label !== right.label) {
      return left.label.localeCompare(right.label);
    }

    if (left.person_id !== right.person_id) {
      return left.person_id.localeCompare(right.person_id);
    }

    return left.start_year - right.start_year;
  });
}

export default async function OfficersPage() {
  const { admin, permissions, council } = await getCurrentActingCouncilContext({
    redirectTo: '/me',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  });

  const [{ data: termData }, { data: personData }, { data: organizationData }] = await Promise.all([
    admin
      .from('person_officer_terms')
      .select('id, person_id, office_scope_code, office_code, office_rank, service_start_year, service_end_year')
      .eq('council_id', council.id)
      .order('service_start_year', { ascending: false }),
    admin
      .from('people')
      .select('id, first_name, last_name, email')
      .eq('council_id', council.id)
      .is('archived_at', null)
      .is('merged_into_person_id', null),
    permissions.organizationId
      ? admin.from('organizations').select('display_name, preferred_name').eq('id', permissions.organizationId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const terms = (termData as OfficerTermRow[] | null) ?? [];
  const people = decryptPeopleRecords((personData as PersonRow[] | null) ?? []);
  const organization = (organizationData as OrganizationNameRecord | null) ?? null;
  const peopleById = new Map(people.map((person) => [person.id, person]));

  const currentTerms = terms.filter((term) => term.service_end_year == null);
  const honorificGroups = buildHonorificGroups(terms);
  const organizationLabel = getOrganizationContextLabel({
    organization,
    fallbackName: council.name ?? null,
    unitNumber: council.council_number ?? null,
  });

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <p className="qv-eyebrow">Officers</p>
          <h1 className="qv-title">{organizationLabel ?? 'Organization officers'}</h1>
          <p className="qv-subtitle">Current officer terms and enduring honorifics.</p>
        </section>

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Current officers</h2>
              <p className="qv-section-subtitle">Who is serving right now.</p>
            </div>
            {permissions.canAccessOrganizationSettings ? (
              <Link href="/me/council" className="qv-link-button qv-button-primary">
                Manage officers
              </Link>
            ) : null}
          </div>

          {currentTerms.length === 0 ? (
            <div className="qv-empty">
              <p className="qv-empty-text">No current officer terms recorded.</p>
            </div>
          ) : (
            <div className="qv-member-list">
              {currentTerms.map((term) => {
                const person = peopleById.get(term.person_id);
                return (
                  <Link key={term.id} href={person ? `/members/${person.id}` : '#'} className="qv-member-link">
                    <div className="qv-member-row">
                      <div className="qv-member-main">
                        <div className="qv-member-text">
                          <div className="qv-member-name">{person ? personName(person) : 'Member not found'}</div>
                          <div className="qv-member-meta">{formatOfficerLabel({ scope: term.office_scope_code, code: term.office_code, rank: term.office_rank })}</div>
                          <div className="qv-member-meta">Started {formatTermRange(term.service_start_year, term.service_end_year)}</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Honorific history</h2>
              <p className="qv-section-subtitle">Completed roles that confer lasting honorifics.</p>
            </div>
          </div>

          {honorificGroups.length === 0 ? (
            <div className="qv-empty">
              <p className="qv-empty-text">No enduring honorifics recorded yet.</p>
            </div>
          ) : (
            <div className="qv-member-list">
              {honorificGroups.map((group) => {
                const person = peopleById.get(group.person_id);
                return (
                  <Link key={`${group.person_id}-${group.label}-${group.start_year}-${group.end_year}`} href={person ? `/members/${person.id}` : '#'} className="qv-member-link">
                    <div className="qv-member-row">
                      <div className="qv-member-main">
                        <div className="qv-member-text">
                          <div className="qv-member-name">{person ? personName(person) : 'Member not found'}</div>
                          <div className="qv-member-meta">{group.label}</div>
                          <div className="qv-member-meta">{formatTermRange(group.start_year, group.end_year)}</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
