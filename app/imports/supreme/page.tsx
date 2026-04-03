import AppHeader from '@/app/app-header';
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context';
import SupremeImportWorkbench from './supreme-import-workbench';
import type { ExistingSupremeComparablePerson } from '@/lib/imports/supreme';
import { decryptPeopleRecords } from '@/lib/security/pii';

type CouncilRow = {
  id: string;
  name: string | null;
  council_number: string | null;
  organization_id: string | null;
};

type MembershipRow = {
  organization_id: string | null;
  membership_number: string | null;
  is_primary_membership?: boolean | null;
};

type PersonKofcProfileRow = {
  first_degree_date: string | null;
  second_degree_date: string | null;
  third_degree_date: string | null;
  years_in_service: number | null;
  member_type: string | null;
  member_class: string | null;
  assembly_number: string | null;
};

type RawExistingPersonRow = {
  id: string;
  primary_relationship_code: string;
  council_activity_level_code: string | null;
  title: string | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  email: string | null;
  cell_phone: string | null;
  address_line_1: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  birth_date: string | null;
  organization_memberships?: MembershipRow[] | null;
  person_kofc_profiles?: PersonKofcProfileRow | PersonKofcProfileRow[] | null;
};

function normalizeMembershipRows(value: RawExistingPersonRow['organization_memberships']) {
  return Array.isArray(value) ? value : [];
}

function normalizeKofcProfile(value: RawExistingPersonRow['person_kofc_profiles']) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function pickMembership(
  memberships: MembershipRow[],
  organizationId: string | null
) {
  if (organizationId) {
    const orgMatch = memberships.find((membership) => membership.organization_id === organizationId);
    if (orgMatch) {
      return orgMatch;
    }
  }

  const primaryMembership = memberships.find((membership) => membership.is_primary_membership);
  return primaryMembership ?? memberships[0] ?? null;
}

export default async function SupremeImportPage() {
  const { admin, council } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/imports/supreme',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  });

  const typedCouncil = council as CouncilRow;

  const { data: peopleData } = await admin
    .from('people')
    .select(
      'id, primary_relationship_code, council_activity_level_code, title, first_name, middle_name, last_name, suffix, email, cell_phone, address_line_1, city, state_province, postal_code, birth_date, organization_memberships(organization_id, membership_number, is_primary_membership), person_kofc_profiles(first_degree_date, second_degree_date, third_degree_date, years_in_service, member_type, member_class, assembly_number)'
    )
    .eq('council_id', council.id)
    .is('archived_at', null)
    .is('merged_into_person_id', null)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true });

  const decryptedPeople = decryptPeopleRecords((peopleData as RawExistingPersonRow[] | null) ?? []);

  const people: ExistingSupremeComparablePerson[] = decryptedPeople.map((person) => {
    const memberships = normalizeMembershipRows(person.organization_memberships);
    const membership = pickMembership(memberships, typedCouncil.organization_id);
    const kofcProfile = normalizeKofcProfile(person.person_kofc_profiles);

    return {
      id: person.id,
      primary_relationship_code: person.primary_relationship_code,
      council_activity_level_code: person.council_activity_level_code,
      title: person.title,
      first_name: person.first_name,
      middle_name: person.middle_name,
      last_name: person.last_name,
      suffix: person.suffix,
      email: person.email,
      cell_phone: person.cell_phone,
      address_line_1: person.address_line_1,
      city: person.city,
      state_province: person.state_province,
      postal_code: person.postal_code,
      birth_date: person.birth_date,
      member_number: membership?.membership_number ?? null,
      supreme_member_type: kofcProfile?.member_type ?? null,
      supreme_member_class: kofcProfile?.member_class ?? null,
      assembly_number: kofcProfile?.assembly_number ?? null,
      first_degree_date: kofcProfile?.first_degree_date ?? null,
      second_degree_date: kofcProfile?.second_degree_date ?? null,
      third_degree_date: kofcProfile?.third_degree_date ?? null,
      years_of_service: kofcProfile?.years_in_service ?? null,
    } satisfies ExistingSupremeComparablePerson;
  });

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <p className="qv-eyebrow">Imports</p>
          <h1 className="qv-title">Supreme member sync</h1>
          <p className="qv-subtitle">
            Upload the Supreme roster, confirm the column mapping, then review each member update before anything is written.
          </p>
        </section>

        <section className="qv-card">
          <div className="qv-detail-list">
            <div className="qv-detail-item">
              <div className="qv-detail-label">Current council</div>
              <div className="qv-detail-value">{(council as CouncilRow)?.name ?? 'Council'}</div>
              {(council as CouncilRow)?.council_number ? (
                <div className="qv-detail-meta">Council {(council as CouncilRow).council_number}</div>
              ) : null}
            </div>
            <div className="qv-detail-item">
              <div className="qv-detail-label">Import anchor</div>
              <div className="qv-detail-value">Member number + council number</div>
              <div className="qv-detail-meta">
                Existing rows match by member number first, then by name plus birth date, then by name only.
              </div>
            </div>
            <div className="qv-detail-item">
              <div className="qv-detail-label">Data destination</div>
              <div className="qv-detail-value">Shared profile + Knights extensions</div>
              <div className="qv-detail-meta">
                Core member details land on the person record. Membership numbers and Knights-only fields stay in the new membership and Knights profile tables.
              </div>
            </div>
          </div>
        </section>

        <SupremeImportWorkbench
          existingPeople={people}
          expectedCouncilNumber={(council as CouncilRow)?.council_number ?? null}
        />
      </div>
    </main>
  );
}
