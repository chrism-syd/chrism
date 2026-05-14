import AppHeader from '@/app/app-header';
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context';
import SupremeImportWorkbench from './supreme-import-workbench';
import { loadSupremeImportExistingPeopleForLocalUnit } from '@/lib/imports/supreme-existing-people';

type CouncilRow = {
  id: string;
  name: string | null;
  council_number: string | null;
  organization_id: string | null;
  local_unit_kind?: string | null;
};

export default async function SupremeImportPage() {
  const { admin, council, localUnitId } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/imports/supreme',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  });

  const typedCouncil = council as CouncilRow;

  if (!localUnitId) {
    return (
      <main className="qv-page">
        <div className="qv-shell">
          <AppHeader />
          <div className="qv-error">
            <strong>Could not load Supreme import.</strong>
            <p>This view is missing its active local organization context.</p>
          </div>
        </div>
      </main>
    );
  }

  const people = await loadSupremeImportExistingPeopleForLocalUnit({
    admin,
    localUnitId,
    organizationId: typedCouncil.organization_id,
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
              <div className="qv-detail-value">{typedCouncil.name ?? 'Council'}</div>
              {typedCouncil.council_number ? (
                <div className="qv-detail-meta">Council {typedCouncil.council_number}</div>
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
          expectedCouncilNumber={typedCouncil.council_number ?? null}
          localUnitKind={typedCouncil.local_unit_kind ?? 'council'}
        />
      </div>
    </main>
  );
}
