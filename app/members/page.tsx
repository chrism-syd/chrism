import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import AppHeader from '@/app/app-header'
import MembersList from '@/app/members-list'
import OrganizationAvatar from '@/app/components/organization-avatar'
import SectionMenuBar from '@/app/components/section-menu-bar'
import PageOrgSwitcher from '@/app/components/page-org-switcher'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { getEffectiveOrganizationName } from '@/lib/organizations/names'
import { loadCouncilMemberDirectoryData } from '@/lib/members/directory-data'

export default async function MembersPage() {
  const permissions = await getCurrentUserPermissions()
  const { admin: supabase, council } = await getCurrentActingCouncilContext({
    redirectTo: '/me',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  })

  let directoryData: Awaited<ReturnType<typeof loadCouncilMemberDirectoryData>>

  try {
    directoryData = await loadCouncilMemberDirectoryData({ admin: supabase, councilId: council.id })
  } catch (error) {
    return (
      <main className="qv-page">
        <div className="qv-shell">
          <AppHeader />
          <div className="qv-error">
            <strong>Could not load members.</strong>
            <p>{error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        </div>
      </main>
    )
  }

  const { data: organizationData } = council.organization_id
    ? await supabase
        .from('organizations')
        .select('display_name, preferred_name, logo_storage_path, logo_alt_text')
        .eq('id', council.organization_id)
        .maybeSingle()
    : { data: null }

  const organization = organizationData as {
    display_name: string | null
    preferred_name: string | null
    logo_storage_path: string | null
    logo_alt_text: string | null
  } | null

  const organizationName = getEffectiveOrganizationName(organization) ?? council.name ?? 'Organization'

  const {
    members,
    prospects,
    volunteers,
    currentOfficerLabelsById,
    executiveOfficerLabelsById,
    officerCount,
  } = directoryData
  const activeMembers = members.filter((person) => person.council_activity_level_code === 'active')

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              <p className="qv-eyebrow">
                {organizationName}
                {council.council_number ? ` (${council.council_number})` : ''}
              </p>
              <div className="qv-directory-title-row" style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <h1 className="qv-directory-name">Member directory</h1>
                <PageOrgSwitcher
                  contexts={permissions.availableContexts}
                  selectedContextKey={permissions.activeContextKey}
                  selectedOrganizationId={permissions.organizationId}
                  isSuperAdmin={permissions.isSuperAdmin}
                  actingMode={permissions.actingMode}
                  fallbackHref="/members"
                />
              </div>
              <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
                Browse and manage members for your council.
              </p>
            </div>
            <div className="qv-org-avatar-wrap">
              <OrganizationAvatar
                displayName={organizationName}
                logoStoragePath={organization?.logo_storage_path ?? null}
                logoAltText={organization?.logo_alt_text ?? organizationName}
                size={72}
              />
            </div>
          </div>
          <div className="qv-stats">
            <div className="qv-stat-card">
              <div className="qv-stat-number">{members.length}</div>
              <div className="qv-stat-label">Members</div>
            </div>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{activeMembers.length}</div>
              <div className="qv-stat-label">Active members</div>
            </div>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{officerCount}</div>
              <div className="qv-stat-label">Current officers</div>
            </div>
            <div className="qv-stat-card">
              <div className="qv-stat-number">{volunteers.length + prospects.length}</div>
              <div className="qv-stat-label">Prospects + volunteers</div>
            </div>
          </div>
        </section>

        <SectionMenuBar
          items={[
            { label: 'Add member', href: '/members/new' },
            { label: 'Import Supreme list', href: '/imports/supreme' },
            { label: 'Archived members', href: '/members/archive' },
          ]}
        />

        <MembersList
          members={members}
          currentOfficerLabelsById={currentOfficerLabelsById}
          executiveOfficerLabelsById={executiveOfficerLabelsById}
        />
      </div>
    </main>
  )
}
