import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import AccountSummarySection from '@/app/me/account-summary-section'
import OrganizationAvatar from '@/app/components/organization-avatar'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { getOrganizationContextLabel, type OrganizationNameRecord } from '@/lib/organizations/names'
import { listClaimedPersonRsvpsForUser } from '@/lib/rsvp/claim'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPeopleRecord, decryptProfileChangeRequestRecord, decryptProfileChangeRequestRecords } from '@/lib/security/pii'

type LinkedPersonRow = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  cell_phone: string | null
  home_phone: string | null
  nickname: string | null
}

type CouncilRow = {
  name: string | null
  council_number: string | null
}

type OrganizationProfileRow = OrganizationNameRecord & {
  logo_storage_path: string | null
  logo_alt_text: string | null
}

type PendingProfileChangeRow = {
  proposed_email: string | null
  proposed_cell_phone: string | null
  proposed_home_phone: string | null
  email_change_requested: boolean
  cell_phone_change_requested: boolean
  home_phone_change_requested: boolean
}

type RejectedProfileChangeRow = PendingProfileChangeRow & {
  reviewed_at: string | null
}

type RejectedFieldNotice = {
  reviewedAt: string | null
}

type RejectedFieldNoticeMap = Partial<Record<'email' | 'cell_phone' | 'home_phone', RejectedFieldNotice>>

function formatDateTimeRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  return (
    new Intl.DateTimeFormat('en-CA', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(start) +
    ' to ' +
    new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit' }).format(end)
  )
}

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

function buildRejectedFieldNotices(rows: RejectedProfileChangeRow[] | null | undefined): RejectedFieldNoticeMap {
  const notices: RejectedFieldNoticeMap = {}

  for (const row of rows ?? []) {
    if (row.email_change_requested && !notices.email) {
      notices.email = { reviewedAt: row.reviewed_at }
    }
    if (row.cell_phone_change_requested && !notices.cell_phone) {
      notices.cell_phone = { reviewedAt: row.reviewed_at }
    }
    if (row.home_phone_change_requested && !notices.home_phone) {
      notices.home_phone = { reviewedAt: row.reviewed_at }
    }
  }

  return notices
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MyProfilePage() {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser) redirect('/login')

  const adminSupabase = createAdminClient()
  const claimedRsvps = await listClaimedPersonRsvpsForUser({
    supabase: adminSupabase,
    userId: permissions.authUser.id,
  })

  const personPromise = permissions.personId
    ? adminSupabase
        .from('people')
        .select('id, first_name, last_name, email, cell_phone, home_phone, nickname')
        .eq('id', permissions.personId)
        .maybeSingle<LinkedPersonRow>()
    : Promise.resolve({ data: null as LinkedPersonRow | null })

  const councilPromise = permissions.councilId
    ? adminSupabase
        .from('councils')
        .select('name, council_number')
        .eq('id', permissions.councilId)
        .maybeSingle<CouncilRow>()
    : Promise.resolve({ data: null as CouncilRow | null })

  const organizationPromise = permissions.organizationId
    ? adminSupabase
        .from('organizations')
        .select('display_name, preferred_name, logo_storage_path, logo_alt_text')
        .eq('id', permissions.organizationId)
        .maybeSingle<OrganizationProfileRow>()
    : Promise.resolve({ data: null as OrganizationProfileRow | null })

  const pendingChangesPromise = permissions.personId
    ? adminSupabase
        .from('person_profile_change_requests')
        .select('proposed_email, proposed_cell_phone, proposed_home_phone, email_change_requested, cell_phone_change_requested, home_phone_change_requested')
        .eq('person_id', permissions.personId)
        .eq('status_code', 'pending')
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle<PendingProfileChangeRow>()
    : Promise.resolve({ data: null as PendingProfileChangeRow | null })

  const rejectedChangesPromise = permissions.personId
    ? adminSupabase
        .from('person_profile_change_requests')
        .select('proposed_email, proposed_cell_phone, proposed_home_phone, email_change_requested, cell_phone_change_requested, home_phone_change_requested, reviewed_at')
        .eq('person_id', permissions.personId)
        .eq('status_code', 'rejected')
        .order('reviewed_at', { ascending: false })
        .limit(12)
        .returns<RejectedProfileChangeRow[]>()
    : Promise.resolve({ data: [] as RejectedProfileChangeRow[] })

  const [personResult, councilResult, organizationResult, pendingResult, rejectedResult] = await Promise.all([
    personPromise,
    councilPromise,
    organizationPromise,
    pendingChangesPromise,
    rejectedChangesPromise,
  ])

  const linkedPerson = personResult.data ? decryptPeopleRecord(personResult.data) : null
  const currentCouncil = councilResult.data ?? null
  const currentOrganization = organizationResult.data ?? null
  const pendingProfileChanges = pendingResult.data ? decryptProfileChangeRequestRecord(pendingResult.data) : null
  const rejectedFieldNotices = buildRejectedFieldNotices(
    decryptProfileChangeRequestRecords((rejectedResult.data as RejectedProfileChangeRow[] | null) ?? [])
  )

  const organizationLabel = permissions.organizationId
    ? getOrganizationContextLabel({
        organization: currentOrganization,
        fallbackName: currentCouncil?.name ?? null,
        unitNumber: currentCouncil?.council_number ?? null,
      })
    : null

  const profileName = linkedPerson
    ? formatDisplayName(linkedPerson.first_name, linkedPerson.last_name, linkedPerson.nickname)
    : permissions.email ?? 'Signed in'
  const officialRecordName = linkedPerson
    ? `${linkedPerson.first_name} ${linkedPerson.last_name}`.trim()
    : 'Not linked yet'
  const addressHelpText = 'If you have an update to your home address, please inform your local council.'

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              <p className="qv-eyebrow">Profile</p>
              <h1 className="qv-title">{profileName}</h1>
            </div>
            {organizationLabel ? (
              <div className="qv-org-avatar-wrap">
                <OrganizationAvatar
                  displayName={organizationLabel}
                  logoStoragePath={currentOrganization?.logo_storage_path ?? null}
                  logoAltText={currentOrganization?.logo_alt_text ?? organizationLabel}
                  size={68}
                />
              </div>
            ) : null}
          </div>
        </section>

        <AccountSummarySection
          officialName={officialRecordName}
          preferredName={linkedPerson?.nickname ?? null}
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
                  preferred_name: null,
                  email_requested: pendingProfileChanges.email_change_requested,
                  cell_phone_requested: pendingProfileChanges.cell_phone_change_requested,
                  home_phone_requested: pendingProfileChanges.home_phone_change_requested,
                }
              : null
          }
          rejectedNotices={rejectedFieldNotices}
        />

        {permissions.isCouncilAdmin ? (
          <div className="qv-form-actions" style={{ marginTop: 20 }}>
            <Link href="/me/council" className="qv-link-button qv-button-primary">
              Organization settings
            </Link>
          </div>
        ) : null}

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
                        {formatDateTimeRange(submission.starts_at, submission.ends_at)}
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
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Last updated {formatDateTime(submission.last_responded_at)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
