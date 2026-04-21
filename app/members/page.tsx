import AppHeader from '@/app/app-header';
import MembersList from '@/app/members-list';
import OrganizationAvatar from '@/app/components/organization-avatar';
import SectionMenuBar from '@/app/components/section-menu-bar';
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context';
import { listAccessibleLocalUnitsForArea } from '@/lib/auth/area-access';
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names';
import { loadLocalUnitMemberDirectoryData } from '@/lib/members/directory-data';

export default async function MembersPage() {
  const { admin: supabase, council, permissions, localUnitId } = await getCurrentActingCouncilContext({
    redirectTo: '/me',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  });

  if (!localUnitId) {
    return (
      <main className="qv-page">
        <div className="qv-shell">
          <AppHeader />
          <div className="qv-error">
            <strong>Could not load people.</strong>
            <p>This view is missing its active local organization context.</p>
          </div>
        </div>
      </main>
    );
  }

  let directoryData: Awaited<ReturnType<typeof loadLocalUnitMemberDirectoryData>>;

  try {
    directoryData = await loadLocalUnitMemberDirectoryData({
      admin: supabase,
      localUnitId,
    });
  } catch (error) {
    return (
      <main className="qv-page">
        <div className="qv-shell">
          <AppHeader />
          <div className="qv-error">
            <strong>Could not load people.</strong>
            <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        </div>
      </main>
    );
  }

  const { data: organizationData } = council.organization_id
    ? await supabase
        .from('organizations')
        .select('display_name, preferred_name, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)')
        .eq('id', council.organization_id)
        .maybeSingle()
    : { data: null };

  const organization = organizationData as {
    display_name: string | null;
    preferred_name: string | null;
    logo_storage_path: string | null;
    logo_alt_text: string | null;
    brand_profile?: {
      code: string | null;
      display_name: string | null;
      logo_storage_bucket: string | null;
      logo_storage_path: string | null;
      logo_alt_text: string | null;
    } | null;
  } | null;

  const allPeople = directoryData.allPeople;
  const members = directoryData.members;
  const prospects = directoryData.prospects;
  const volunteers = directoryData.volunteers;
  const currentOfficerLabelsById = directoryData.currentOfficerLabelsById;
  const executiveOfficerLabelsById = directoryData.executiveOfficerLabelsById;

  const organizationName = getEffectiveOrganizationName(organization) ?? council.name ?? 'Organization';
  const effectiveBranding = getEffectiveOrganizationBranding(organization);
  const currentCouncilLabel = `${council.name ?? organizationName}${council.council_number ? ` (${council.council_number})` : ''}`;

  const switchableLocalUnits = permissions.authUser
    ? (
        await listAccessibleLocalUnitsForArea({
          admin: supabase,
          userId: permissions.authUser.id,
          areaCode: 'members',
          minimumAccessLevel: 'edit_manage',
        })
      )
        .filter((unit) => unit.local_unit_id !== localUnitId)
        .sort((left, right) => left.local_unit_name.localeCompare(right.local_unit_name))
    : [];

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section
          style={{
            display: 'grid',
            gap: 14,
            paddingTop: 28,
            marginBottom: 18,
          }}
        >
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
            People Directory
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: '34ch',
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.35,
              color: 'var(--text-secondary)',
            }}
          >
            Browse and manage people for your local organization.
          </p>
        </section>

        <section className="qv-hero-card">
          <div style={{ display: 'grid', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 18,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'grid', gap: 12 }}>
                <h2 className="qv-section-title" style={{ margin: 0 }}>
                  {currentCouncilLabel}
                </h2>

                {switchableLocalUnits.length > 0 && !permissions.isDevMode ? (
                  <details className="qv-view-menu">
                    <summary>
                      <span>Change local organization</span>
                      <span aria-hidden="true" className="qv-view-menu-chevron">
                        ▾
                      </span>
                    </summary>
                    <div className="qv-view-menu-panel">
                      {switchableLocalUnits.map((unit) => (
                        <form key={unit.local_unit_id} method="post" action="/account/parallel-area-context">
                          <input type="hidden" name="areaCode" value="members" />
                          <input type="hidden" name="minimumAccessLevel" value="edit_manage" />
                          <input type="hidden" name="localUnitId" value={unit.local_unit_id} />
                          <input type="hidden" name="next" value="/members" />
                          <button
                            type="submit"
                            className="qv-view-menu-item"
                            style={{ width: '100%', justifyContent: 'flex-start' }}
                          >
                            {unit.local_unit_name}
                          </button>
                        </form>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>

              <div className="qv-org-avatar-wrap">
                <OrganizationAvatar
                  displayName={organizationName}
                  logoStoragePath={effectiveBranding.logo_storage_path}
                  logoAltText={effectiveBranding.logo_alt_text ?? organizationName}
                  size={72}
                />
              </div>
            </div>

            <div className="qv-stats" style={{ marginTop: 0 }}>
              <div className="qv-stat-card">
                <div className="qv-stat-number">{allPeople.length}</div>
                <div className="qv-stat-label">Total people</div>
              </div>
              <div className="qv-stat-card">
                <div className="qv-stat-number">{members.length}</div>
                <div className="qv-stat-label">Members</div>
              </div>
              <div className="qv-stat-card">
                <div className="qv-stat-number">{volunteers.length}</div>
                <div className="qv-stat-label">Volunteers</div>
              </div>
              <div className="qv-stat-card">
                <div className="qv-stat-number">{prospects.length}</div>
                <div className="qv-stat-label">Prospects</div>
              </div>
            </div>
          </div>
        </section>

        <SectionMenuBar
          items={[
            { label: 'Add person', href: '/members/new' },
            { label: 'Import Supreme list', href: '/imports/supreme' },
            { label: 'Archived people', href: '/members/archive' },
          ]}
        />

        <MembersList
          members={allPeople}
          currentOfficerLabelsById={currentOfficerLabelsById}
          executiveOfficerLabelsById={executiveOfficerLabelsById}
          sectionTitle="People listing"
          sectionSubtitle="Search, sort, and manage people records."
        />
      </div>
    </main>
  );
}
