import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import AccountSummarySection from '@/app/me/account-summary-section'
import ClaimReviewNoticeCard from '@/app/me/claim-review-notice-card'
import ProfileBackButton from '@/app/me/profile-back-button'
import OrganizationAvatar from '@/app/components/organization-avatar'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { getParallelAreaAccessSummary } from '@/lib/auth/parallel-access-summary'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName, getOrganizationContextLabel, type OrganizationNameRecord } from '@/lib/organizations/names'
import { listClaimedPersonRsvpsForUser } from '@/lib/rsvp/claim'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPeopleRecord, decryptProfileChangeRequestRecord, decryptProfileChangeRequestRecords } from '@/lib/security/pii'
import { formatEventDateTimeRange } from '@/lib/events/display'

type LinkedPersonRow = {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  email: string | null
  cell_phone: string | null
  home_phone: string | null
  nickname: string | null
}

type CouncilRow = { name: string | null; council_number: string | null }
type OrganizationProfileRow = OrganizationNameRecord & {
  id: string
  logo_storage_path: string | null
  logo_alt_text: string | null
  brand_profile?: {
    code: string | null
    display_name: string | null
    logo_storage_bucket: string | null
    logo_storage_path: string | null
    logo_alt_text: string | null
  } | null
}
type PendingProfileChangeRow = {
  proposed_first_name: string | null
  proposed_last_name: string | null
  proposed_preferred_name: string | null
  proposed_email: string | null
  proposed_cell_phone: string | null
  proposed_home_phone: string | null
  email_change_requested: boolean
  cell_phone_change_requested: boolean
  home_phone_change_requested: boolean
}
type ReviewedProfileChangeRow = PendingProfileChangeRow & {
  id: string
  reviewed_at: string | null
  status_code: 'approved' | 'rejected'
  decision_notice_cleared_at: string | null
}
type PendingClaimNoticeRow = {
  id: string
  status_code: 'approved' | 'rejected'
  review_notes: string | null
  reviewed_at: string | null
  requested_council_name: string | null
  requested_council_number: string | null
  requested_city: string | null
}
type AffiliationMembershipRow = {
  organization_id: string
  is_primary_membership: boolean | null
  source_code: string | null
  membership_status_code: string | null
}
type RejectedFieldNotice = { requestId: string; reviewedAt: string | null }
type RejectedFieldNoticeMap = Partial<Record<'email' | 'cell_phone' | 'home_phone', RejectedFieldNotice>>

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDisplayName(firstName: string, lastName: string, preferredName?: string | null) {
  const leadName = preferredName && preferredName.trim().length > 0 ? preferredName.trim() : firstName
  return `${leadName} ${lastName}`.trim()
}

function buildRejectedFieldNotices(rows: ReviewedProfileChangeRow[] | null | undefined): RejectedFieldNoticeMap {
  const notices: RejectedFieldNoticeMap = {}
  const latestByField: Partial<Record<'email' | 'cell_phone' | 'home_phone', ReviewedProfileChangeRow>> = {}

  for (const row of rows ?? []) {
    if (row.email_change_requested && !latestByField.email) latestByField.email = row
    if (row.cell_phone_change_requested && !latestByField.cell_phone) latestByField.cell_phone = row
    if (row.home_phone_change_requested && !latestByField.home_phone) latestByField.home_phone = row
  }

  if (latestByField.email?.status_code === 'rejected' && !latestByField.email.decision_notice_cleared_at) {
    notices.email = { requestId: latestByField.email.id, reviewedAt: latestByField.email.reviewed_at }
  }
  if (latestByField.cell_phone?.status_code === 'rejected' && !latestByField.cell_phone.decision_notice_cleared_at) {
    notices.cell_phone = { requestId: latestByField.cell_phone.id, reviewedAt: latestByField.cell_phone.reviewed_at }
  }
  if (latestByField.home_phone?.status_code === 'rejected' && !latestByField.home_phone.decision_notice_cleared_at) {
    notices.home_phone = { requestId: latestByField.home_phone.id, reviewedAt: latestByField.home_phone.reviewed_at }
  }

  return notices
}

function buildCouncilLabel(claim: PendingClaimNoticeRow | null) {
  if (!claim) return null
  if (claim.requested_council_name && claim.requested_council_number) {
    return `${claim.requested_council_name} (${claim.requested_council_number})`
  }
  return claim.requested_council_name ?? claim.requested_council_number ?? claim.requested_city ?? null
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MyProfilePage() {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser) redirect('/login')

  const adminSupabase = createAdminClient()
  const parallelAreaAccess = await getParallelAreaAccessSummary({ admin: adminSupabase, permissions })
  const claimedRsvps = await listClaimedPersonRsvpsForUser({ supabase: adminSupabase, userId: permissions.authUser.id })

  const personPromise = permissions.personId
    ? adminSupabase
        .from('people')
        .select('id, first_name, middle_name, last_name, email, cell_phone, home_phone, nickname')
        .eq('id', permissions.personId)
        .maybeSingle<LinkedPersonRow>()
    : Promise.resolve({ data: null as LinkedPersonRow | null })

  const councilPromise = permissions.councilId
    ? adminSupabase.from('councils').select('name, council_number').eq('id', permissions.councilId).maybeSingle<CouncilRow>()
    : Promise.resolve({ data: null as CouncilRow | null })

  const memberRecordPromise =
    permissions.personId && permissions.activeLocalUnitId
      ? adminSupabase
          .from('member_records')
          .select('preferred_display_name')
          .eq('local_unit_id', permissions.activeLocalUnitId)
          .eq('legacy_people_id', permissions.personId)
          .is('archived_at', null)
          .maybeSingle<{ preferred_display_name: string | null }>()
      : Promise.resolve({ data: null as { preferred_display_name: string | null } | null })

  const organizationPromise = permissions.organizationId
    ? adminSupabase
        .from('organizations')
        .select('id, display_name, preferred_name, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)')
        .eq('id', permissions.organizationId)
        .maybeSingle<OrganizationProfileRow>()
    : Promise.resolve({ data: null as OrganizationProfileRow | null })

  const membershipsPromise = permissions.personId
    ? adminSupabase
        .from('organization_memberships')
        .select('organization_id, is_primary_membership, source_code, membership_status_code')
        .eq('person_id', permissions.personId)
        .returns<AffiliationMembershipRow[]>()
    : Promise.resolve({ data: [] as AffiliationMembershipRow[] })

  const pendingChangesPromise = permissions.personId
    ? adminSupabase
        .from('person_profile_change_requests')
        .select(
          'proposed_first_name, proposed_last_name, proposed_preferred_name, proposed_email, proposed_cell_phone, proposed_home_phone, email_change_requested, cell_phone_change_requested, home_phone_change_requested'
        )
        .eq('person_id', permissions.personId)
        .eq('status_code', 'pending')
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle<PendingProfileChangeRow>()
    : Promise.resolve({ data: null as PendingProfileChangeRow | null })

  const reviewedChangesPromise = permissions.personId
    ? adminSupabase
        .from('person_profile_change_requests')
        .select(
          'id, proposed_email, proposed_cell_phone, proposed_home_phone, email_change_requested, cell_phone_change_requested, home_phone_change_requested, reviewed_at, status_code, decision_notice_cleared_at'
        )
        .eq('person_id', permissions.personId)
        .in('status_code', ['approved', 'rejected'])
        .order('reviewed_at', { ascending: false })
        .limit(20)
        .returns<ReviewedProfileChangeRow[]>()
    : Promise.resolve({ data: [] as ReviewedProfileChangeRow[] })

  const claimNoticePromise = adminSupabase
    .from('organization_claim_requests')
    .select('id, status_code, review_notes, reviewed_at, requested_council_name, requested_council_number, requested_city')
    .eq('requested_by_auth_user_id', permissions.authUser.id)
    .in('status_code', ['approved', 'rejected'])
    .is('requester_notice_dismissed_at', null)
    .order('reviewed_at', { ascending: false })
    .limit(1)
    .maybeSingle<PendingClaimNoticeRow>()

  const [personResult, councilResult, memberRecordResult, organizationResult, membershipsResult, pendingResult, reviewedResult, claimNoticeResult] =
    await Promise.all([
      personPromise,
      councilPromise,
      memberRecordPromise,
      organizationPromise,
      membershipsPromise,
      pendingChangesPromise,
      reviewedChangesPromise,
      claimNoticePromise,
    ])

  const linkedPerson = personResult.data ? decryptPeopleRecord(personResult.data) : null
  const currentCouncil = councilResult.data ?? null
  const currentOrganization = organizationResult.data ?? null
  const currentPreferredName = memberRecordResult.data?.preferred_display_name ?? linkedPerson?.nickname ?? null
  const pendingProfileChanges = pendingResult.data ? decryptProfileChangeRequestRecord(pendingResult.data) : null
  const rejectedFieldNotices = buildRejectedFieldNotices(
    decryptProfileChangeRequestRecords((reviewedResult.data as ReviewedProfileChangeRow[] | null) ?? []) as ReviewedProfileChangeRow[]
  )
  const claimNotice = claimNoticeResult.data ?? null
  const affiliationMemberships = membershipsResult.data ?? []

  const organizationLabel = permissions.organizationId
    ? getOrganizationContextLabel({
        organization: currentOrganization,
        fallbackName: currentCouncil?.name ?? null,
        unitNumber: currentCouncil?.council_number ?? null,
      })
    : null

  const affiliationOrganizationIds = [
    ...new Set(
      [
        ...affiliationMemberships.map((membership) => membership.organization_id),
        ...permissions.availableContexts.map((context) => context.organizationId),
        permissions.organizationId ?? null,
      ].filter((value): value is string => Boolean(value))
    ),
  ]

  const affiliationOrganizationsResult = affiliationOrganizationIds.length > 0
    ? await adminSupabase
        .from('organizations')
        .select('id, display_name, preferred_name, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)')
        .in('id', affiliationOrganizationIds)
        .returns<OrganizationProfileRow[]>()
    : { data: [] as OrganizationProfileRow[] }

  const affiliationOrganizations = (affiliationOrganizationsResult.data ?? []).map((organization) => {
    const membership = affiliationMemberships.find((item) => item.organization_id === organization.id) ?? null
    const effectiveBranding = getEffectiveOrganizationBranding(organization)
    const ownLogoPath = organization.logo_storage_path?.trim().toLowerCase() || null
    const brandProfileCode = organization.brand_profile?.code?.trim().toLowerCase() || null
    const brandProfileLogoPath = organization.brand_profile?.logo_storage_path?.trim().toLowerCase() || null
    const hasDistinctLocalOverride = Boolean(ownLogoPath) && Boolean(brandProfileLogoPath) && ownLogoPath !== brandProfileLogoPath
    const dedupeKey = hasDistinctLocalOverride ? `local:${ownLogoPath}` : brandProfileCode ? `brand:${brandProfileCode}` : brandProfileLogoPath ? `brand-logo:${brandProfileLogoPath}` : ownLogoPath ? `local:${ownLogoPath}` : `org:${organization.id}`

    return {
      ...organization,
      isCurrent: organization.id === permissions.organizationId,
      isPrimaryMembership: membership?.is_primary_membership ?? false,
      displayLabel: getEffectiveOrganizationName(organization) ?? 'Organization',
      effective_logo_storage_path: effectiveBranding.logo_storage_path,
      effective_logo_alt_text: effectiveBranding.logo_alt_text,
      dedupe_key: dedupeKey,
    }
  })

  affiliationOrganizations.sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) return left.isCurrent ? -1 : 1
    if (left.isPrimaryMembership !== right.isPrimaryMembership) return left.isPrimaryMembership ? -1 : 1
    return left.displayLabel.localeCompare(right.displayLabel)
  })

  const affiliationLogoGroups = new Map<string, Array<{ id: string; displayLabel: string; logo_storage_path: string | null; logo_alt_text: string | null; isCurrent: boolean }>>()

  for (const organization of affiliationOrganizations) {
    const key = organization.dedupe_key
    const group = affiliationLogoGroups.get(key) ?? []
    group.push({
      id: organization.id,
      displayLabel: organization.displayLabel,
      logo_storage_path: organization.effective_logo_storage_path,
      logo_alt_text: organization.effective_logo_alt_text ?? null,
      isCurrent: organization.isCurrent,
    })
    affiliationLogoGroups.set(key, group)
  }

  const affiliationLogos = [...affiliationLogoGroups.entries()].map(([key, group]) => {
    const primary = group[0]
    return {
      key,
      displayName: primary.displayLabel,
      logoStoragePath: primary.logo_storage_path,
      logoAltText: primary.logo_alt_text ?? primary.displayLabel,
      title: group.map((item) => item.displayLabel).join(' • '),
    }
  })

  const profileName = linkedPerson
    ? formatDisplayName(linkedPerson.first_name, linkedPerson.last_name, currentPreferredName)
    : permissions.email ?? 'Signed in'
  const officialRecordName = linkedPerson
    ? [linkedPerson.first_name, linkedPerson.middle_name, linkedPerson.last_name].filter(Boolean).join(' ')
    : 'Your personal profile'
  const addressHelpText = permissions.organizationId
    ? 'If you have an update to your home address, please inform your local council.'
    : null
  const adminClaimHeading = organizationLabel ? `Need admin access for ${organizationLabel}?` : 'Already with an organization on Chrism?'
  const isAlreadyOrganizationAdmin =
    permissions.canAccessMemberData ||
    permissions.canReviewMemberChanges ||
    permissions.canManageCustomLists ||
    permissions.canManageAdmins ||
    permissions.canAccessOrganizationSettings ||
    parallelAreaAccess.membersManage ||
    parallelAreaAccess.eventsManage ||
    parallelAreaAccess.customListsManage ||
    parallelAreaAccess.localUnitSettingsManage ||
    permissions.availableContexts.some(
      (context) => context.organizationId === permissions.organizationId && context.accessLevel !== 'member'
    )

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                <ProfileBackButton />
                <p className="qv-eyebrow" style={{ margin: 0 }}>Profile</p>
              </div>
              <h1 className="qv-title">{profileName}</h1>

              {affiliationLogos.length > 0 ? (
                <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                  <p className="qv-inline-message" style={{ margin: 0 }}>
                    Your organizations
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {affiliationLogos.map((organization) => (
                      <OrganizationAvatar
                        key={organization.key}
                        displayName={organization.displayName}
                        logoStoragePath={organization.logoStoragePath}
                        logoAltText={organization.logoAltText}
                        title={organization.title}
                        size={48}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <AccountSummarySection
          officialName={officialRecordName}
          firstName={linkedPerson?.first_name ?? null}
          lastName={linkedPerson?.last_name ?? null}
          preferredName={currentPreferredName}
          email={linkedPerson?.email ?? permissions.email ?? null}
          cellPhone={linkedPerson?.cell_phone ?? null}
          homePhone={linkedPerson?.home_phone ?? null}
          addressHelpText={addressHelpText}
          pendingValues={
            pendingProfileChanges
              ? {
                  email: pendingProfileChanges.proposed_email,
                  cell_phone: pendingProfileChanges.proposed_cell_phone,
                  home_phone: pendingProfileChanges.proposed_home_phone,
                  email_requested: pendingProfileChanges.email_change_requested,
                  cell_phone_requested: pendingProfileChanges.cell_phone_change_requested,
                  home_phone_requested: pendingProfileChanges.home_phone_change_requested,
                  first_name: pendingProfileChanges.proposed_first_name,
                  last_name: pendingProfileChanges.proposed_last_name,
                  preferred_name: null,
                }
              : null
          }
          rejectedNotices={rejectedFieldNotices}
          allowStandaloneIdentityEdit={!permissions.organizationId}
        />

        {claimNotice ? (
          <ClaimReviewNoticeCard
            claimId={claimNotice.id}
            status={claimNotice.status_code}
            reviewedAt={claimNotice.reviewed_at}
            reviewNotes={claimNotice.review_notes}
            councilLabel={buildCouncilLabel(claimNotice)}
          />
        ) : null}

        {permissions.canAccessOrganizationSettings || parallelAreaAccess.localUnitSettingsManage ? (
          <div className="qv-form-actions" style={{ marginTop: 20 }}>
            <Link href="/me/council" className="qv-link-button qv-button-primary">
              Organization settings
            </Link>
          </div>
        ) : isAlreadyOrganizationAdmin ? null : (
          <section className="qv-card" style={{ marginTop: 20 }}>
            <div className="qv-directory-section-head">
              <div>
                <h2 className="qv-section-title">{adminClaimHeading}</h2>
                <p className="qv-section-subtitle">
                  {permissions.organizationId
                    ? 'Submit a claim for review and we will verify it against the state database before granting access.'
                    : 'Look up your organization and request access if your local group is already using Chrism.'}
                </p>
              </div>
            </div>
            <div className="qv-form-actions">
              <Link href="/me/claim-organization" className="qv-link-button qv-button-primary">
                {permissions.organizationId ? 'Claim organization access' : 'Find your organization'}
              </Link>
            </div>
          </section>
        )}

        {claimedRsvps.length > 0 ? (
          <section className="qv-card">
            <div className="qv-directory-section-head">
              <div>
                <h2 className="qv-section-title">My RSVPs</h2>
                <p className="qv-section-subtitle">
                  These are RSVPs to events where you were invited to, using your registered email address.
                </p>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              {claimedRsvps.map((submission) => (
                <div
                  key={submission.id}
                  style={{
                    border: '1px solid var(--divider)',
                    borderRadius: 16,
                    padding: 16,
                    background: 'var(--bg-sunken)',
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <h2 className="qv-section-title" style={{ fontSize: 22 }}>
                        {submission.event_title}
                      </h2>
                      <p className="qv-section-subtitle" style={{ marginTop: 6 }}>
                        {formatEventDateTimeRange(submission.starts_at, submission.ends_at)}
                      </p>
                    </div>
                    {submission.host_token ? (
                      <Link
                        href={`/rsvp/${submission.host_token}/manage?submission=${encodeURIComponent(submission.id)}`}
                        className="qv-link-button qv-button-primary"
                      >
                        Manage RSVP
                      </Link>
                    ) : null}
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    <p>{submission.primary_name}</p>
                    {submission.primary_email ? <p>{submission.primary_email}</p> : null}
                    {submission.primary_phone ? <p>{submission.primary_phone}</p> : null}
                  </div>
                  <p style={{ color: 'var(--text-secondary)' }}>Last updated {formatDateTime(submission.last_responded_at)}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
