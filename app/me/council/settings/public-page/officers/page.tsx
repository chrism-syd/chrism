/* eslint-disable @typescript-eslint/no-explicit-any -- local_unit_public_officers is added by this branch before generated Supabase types are refreshed. */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import ClearFlashMessageCookie from '@/app/components/clear-flash-message-cookie'
import PortraitUploader from '@/app/components/portrait-uploader'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { getFlashMessage } from '@/lib/flash-messages'
import { formatOfficerLabel, isOfficerTermActive, type OfficerScopeCode } from '@/lib/members/officer-roles'
import { decryptPeopleRecords } from '@/lib/security/pii'
import { buildCouncilPublicOrgSlug } from '@/lib/public-org-slugs'
import {
  removeOfficerPortraitAction,
  saveOfficerPublicProfileAction,
  uploadOfficerPortraitAction,
} from './actions'
import './officers-settings.css'

type PersonRow = {
  id: string
  first_name: string
  last_name: string
  nickname: string | null
  email: string | null
}

type MemberRecordRow = {
  legacy_people_id: string | null
  preferred_display_name: string | null
}

type OfficerTermRow = {
  id: string
  person_id: string
  office_scope_code: OfficerScopeCode
  office_code: string
  office_rank: number | null
  service_start_year: number
  service_end_year: number | null
  manual_end_effective_date?: string | null
  office_label: string
}

type PublicOfficerRow = {
  id: string
  person_officer_term_id: string
  person_id: string
  display_name_override: string | null
  public_title_override: string | null
  public_email: string | null
  is_public: boolean
  sort_order: number
  photo_storage_bucket: string | null
  photo_storage_path: string | null
  photo_zoom: number | null
  photo_position_x: number | null
  photo_position_y: number | null
}

type OfficerProfileView = {
  term: OfficerTermRow
  person: PersonRow | null
  preferredDisplayName: string | null
  memberLabel: string
  officeLabel: string
  serviceLabel: string
  publicProfile: PublicOfficerRow | null
  portraitUrl: string | null
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function officialMemberName(member: Pick<PersonRow, 'first_name' | 'last_name'> | null) {
  if (!member) return 'Unknown member'

  const lastName = member.last_name.trim()
  const firstName = member.first_name.trim()
  return `${firstName} ${lastName}`.trim()
}

function memberName(
  member: Pick<PersonRow, 'first_name' | 'last_name' | 'nickname'> | null,
  preferredDisplayName?: string | null
) {
  if (!member) return 'Unknown member'

  const preferred = preferredDisplayName?.trim() || member.nickname?.trim() || member.first_name.trim()
  const lastName = member.last_name.trim()
  return `${preferred} ${lastName}`.trim()
}

function normalizeName(value: string | null | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function hasMeaningfulPreferredName(args: {
  person: PersonRow | null
  preferredDisplayName: string | null
}) {
  if (!args.person) return false
  return normalizeName(memberName(args.person, args.preferredDisplayName)) !== normalizeName(officialMemberName(args.person))
}

function shouldUsePreferredNameByDefault(args: {
  publicProfile: PublicOfficerRow | null
  person: PersonRow | null
  preferredDisplayName: string | null
}) {
  if (!args.person) return true
  const displayNameOverride = args.publicProfile?.display_name_override?.trim()
  if (!displayNameOverride) return true

  return displayNameOverride === memberName(args.person, args.preferredDisplayName)
}

function customDisplayNameValue(args: {
  publicProfile: PublicOfficerRow | null
  person: PersonRow | null
  preferredDisplayName: string | null
}) {
  const displayNameOverride = args.publicProfile?.display_name_override?.trim()
  if (!displayNameOverride) return ''

  const officialLabel = officialMemberName(args.person)
  const preferredLabel = memberName(args.person, args.preferredDisplayName)

  if (displayNameOverride === officialLabel || displayNameOverride === preferredLabel) return ''
  return displayNameOverride
}

function officeSortPriority(term: Pick<OfficerTermRow, 'office_scope_code' | 'office_code' | 'office_rank'>) {
  const key = `${term.office_scope_code}:${term.office_code}`
  switch (key) {
    case 'council:grand_knight':
      return 1
    case 'council:financial_secretary':
      return 2
    case 'council:deputy_grand_knight':
      return 3
    case 'council:chancellor':
      return 4
    case 'council:recorder':
      return 5
    case 'council:treasurer':
      return 6
    case 'council:advocate':
      return 7
    case 'council:warden':
      return 8
    case 'council:inside_guard':
      return 9
    case 'council:outside_guard':
      return 10
    case 'council:trustee':
      return 20 + (term.office_rank ?? 0)
    default:
      return 100
  }
}

function formatServiceLabel(term: OfficerTermRow) {
  return `${term.service_start_year}${term.service_end_year ? ` to ${term.service_end_year}` : ' to present'}`
}

async function signedPortraitUrl(admin: ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>, officer: PublicOfficerRow | null) {
  if (!officer?.photo_storage_bucket || !officer.photo_storage_path) return null

  const { data } = await admin.storage
    .from(officer.photo_storage_bucket)
    .createSignedUrl(officer.photo_storage_path, 60 * 60)

  return data?.signedUrl ?? null
}

export default async function PublicOfficerSettingsPage() {
  const flashMessage = await getFlashMessage()
  const errorMessage = flashMessage?.kind === 'error' ? flashMessage.message : null
  const noticeMessage = flashMessage?.kind === 'notice' ? flashMessage.message : null
  const shouldClearFlashMessage = Boolean(flashMessage)

  const { admin, permissions, council, localUnitId } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/me',
    areaCode: 'local_unit_settings',
    minimumAccessLevel: 'manage',
  })

  if (!permissions.organizationId) redirect('/me')
  if (!permissions.canAccessOrganizationSettings) redirect('/me')
  if (!localUnitId) redirect('/me/council')

  const { data: officerData } = await admin
    .from('person_officer_terms')
    .select('id, person_id, office_scope_code, office_code, office_rank, service_start_year, service_end_year, manual_end_effective_date, office_label')
    .eq('council_id', council.id)
    .order('service_start_year', { ascending: false })

  const officerTerms = ((officerData as OfficerTermRow[] | null) ?? [])
    .filter((term) => isOfficerTermActive(term, { useKnightsOfColumbusFraternalYear: true }))
    .sort((left, right) => {
      const priorityDifference = officeSortPriority(left) - officeSortPriority(right)
      if (priorityDifference !== 0) return priorityDifference
      return formatOfficerLabel(left).localeCompare(formatOfficerLabel(right))
    })

  const termIds = officerTerms.map((term) => term.id)
  const personIds = [...new Set(officerTerms.map((term) => term.person_id))]
  const [{ data: publicOfficerData }, { data: personData }, { data: memberRecordData }] = await Promise.all([
    termIds.length > 0
      ? (admin as any)
          .from('local_unit_public_officers')
          .select('id, person_officer_term_id, person_id, display_name_override, public_title_override, public_email, is_public, sort_order, photo_storage_bucket, photo_storage_path, photo_zoom, photo_position_x, photo_position_y')
          .eq('local_unit_id', localUnitId)
          .in('person_officer_term_id', termIds)
      : Promise.resolve({ data: [] as PublicOfficerRow[] }),
    personIds.length > 0
      ? admin
          .from('people')
          .select('id, first_name, last_name, nickname, email')
          .in('id', personIds)
          .is('archived_at', null)
      : Promise.resolve({ data: [] as PersonRow[] }),
    personIds.length > 0
      ? (admin as any)
          .from('member_records')
          .select('legacy_people_id, preferred_display_name')
          .eq('local_unit_id', localUnitId)
          .in('legacy_people_id', personIds)
          .is('archived_at', null)
      : Promise.resolve({ data: [] as MemberRecordRow[] }),
  ])

  const publicOfficerByTermId = new Map(
    ((publicOfficerData as PublicOfficerRow[] | null) ?? []).map((row) => [row.person_officer_term_id, row])
  )
  const people = decryptPeopleRecords((personData as PersonRow[] | null) ?? [])
  const personById = new Map(people.map((person) => [person.id, person]))
  const preferredDisplayNameByPersonId = new Map(
    ((memberRecordData as MemberRecordRow[] | null) ?? [])
      .filter((row) => Boolean(row.legacy_people_id))
      .map((row) => [row.legacy_people_id!, row.preferred_display_name?.trim() || null])
  )

  const officerProfiles: OfficerProfileView[] = await Promise.all(
    officerTerms.map(async (term, index) => {
      const publicProfile = publicOfficerByTermId.get(term.id) ?? null
      const person = personById.get(term.person_id) ?? null
      const preferredDisplayName = preferredDisplayNameByPersonId.get(term.person_id) ?? null
      const memberLabel = publicProfile?.display_name_override ?? memberName(person, preferredDisplayName)
      const officeLabel = publicProfile?.public_title_override ?? formatOfficerLabel(term)
      const portraitUrl = await signedPortraitUrl(admin, publicProfile)

      return {
        term,
        person,
        preferredDisplayName,
        memberLabel,
        officeLabel,
        serviceLabel: formatServiceLabel(term),
        publicProfile: publicProfile
          ? { ...publicProfile, sort_order: publicProfile.sort_order ?? index + 1 }
          : null,
        portraitUrl,
      }
    })
  )

  const publicSlug = council.council_number
    ? buildCouncilPublicOrgSlug({ name: council.name, councilNumber: council.council_number })
    : null
  const publicOfficersHref = publicSlug ? `/o/${publicSlug}/officers` : null

  return (
    <main className="qv-page">
      <div className="qv-shell">
        {shouldClearFlashMessage ? <ClearFlashMessageCookie /> : null}
        <AppHeader />

        <section style={{ display: 'grid', gap: 14, paddingTop: 28, marginBottom: 18 }}>
          <p className="qv-eyebrow">Public page settings</p>
          <div className="qv-detail-action-row" style={{ alignItems: 'flex-start' }}>
            <div>
              <h1 className="qv-directory-name" style={{ margin: 0, fontSize: 'clamp(42px, 6.4vw, 68px)', lineHeight: 0.96, letterSpacing: '-0.04em' }}>
                Public Officers
              </h1>
              <p style={{ margin: '14px 0 0', maxWidth: '48ch', fontSize: 15, fontWeight: 700, lineHeight: 1.35, color: 'var(--text-secondary)' }}>
                Choose which current officers appear publicly, adjust names and ordering, and position portraits without cropping the original image.
              </p>
            </div>
            <div className="qv-directory-actions">
              <Link href="/me/council/settings/public-page" className="qv-link-button qv-button-secondary">Back to public page settings</Link>
              {publicOfficersHref ? <Link href={publicOfficersHref} className="qv-link-button qv-button-primary">View public officers</Link> : null}
            </div>
          </div>
        </section>

        {errorMessage ? <div className="qv-form-alert">{errorMessage}</div> : null}
        {noticeMessage ? <div className="qv-empty" style={{ borderStyle: 'solid' }}>{noticeMessage}</div> : null}

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <p className="qv-eyebrow">Public page</p>
              <h2 className="qv-section-title">Officer profiles</h2>
              <p className="qv-section-subtitle">
                These settings affect only what visitors see. The official officer term remains the operational record.
              </p>
            </div>
          </div>

          {officerProfiles.length === 0 ? (
            <div className="qv-empty" style={{ marginTop: 18 }}>
              <p className="qv-empty-text">No current officer assignments are recorded yet.</p>
              <p className="qv-section-subtitle" style={{ margin: 0 }}>
                Add officer terms from Council Settings first. Once officers are on file, you can choose who appears publicly.
              </p>
            </div>
          ) : (
            <div className="qv-officer-settings-grid" style={{ marginTop: 18 }}>
              {officerProfiles.map((profile, index) => {
                const publicProfile = profile.publicProfile
                const sortOrder = publicProfile?.sort_order ?? index + 1
                const zoom = Number(publicProfile?.photo_zoom ?? 1)
                const positionX = Number(publicProfile?.photo_position_x ?? 50)
                const positionY = Number(publicProfile?.photo_position_y ?? 50)
                const officialLabel = officialMemberName(profile.person)
                const preferredLabel = memberName(profile.person, profile.preferredDisplayName)
                const hasPreferredName = hasMeaningfulPreferredName({
                  person: profile.person,
                  preferredDisplayName: profile.preferredDisplayName,
                })
                const usePreferredName = shouldUsePreferredNameByDefault({
                  publicProfile,
                  person: profile.person,
                  preferredDisplayName: profile.preferredDisplayName,
                })
                const customNameValue = customDisplayNameValue({
                  publicProfile,
                  person: profile.person,
                  preferredDisplayName: profile.preferredDisplayName,
                })
                const profileFormId = `officer-public-profile-${profile.term.id}`

                return (
                  <article key={profile.term.id} className="qv-officer-public-card">
                    <div className="qv-officer-public-summary">
                      <PortraitUploader
                        idPrefix={`officer-${profile.term.id}`}
                        uploadAction={uploadOfficerPortraitAction}
                        removeAction={removeOfficerPortraitAction}
                        hiddenFields={{ term_id: profile.term.id }}
                        profileFormId={profileFormId}
                        imageUrl={profile.portraitUrl}
                        imageAlt={`${profile.memberLabel} portrait`}
                        zoom={zoom}
                        positionX={positionX}
                        positionY={positionY}
                        placeholderLabel="Portrait not set"
                      />
                      <div className="qv-officer-public-meta">
                        <h3 className="qv-officer-public-title">{profile.officeLabel}</h3>
                        <p className="qv-officer-public-subtitle">{profile.memberLabel}</p>
                        <p className="qv-officer-public-subtitle">{profile.serviceLabel}</p>
                      </div>
                    </div>

                    <div className="qv-officer-public-forms">
                      <form id={profileFormId} action={saveOfficerPublicProfileAction} className="qv-officer-public-form">
                        <input type="hidden" name="term_id" value={profile.term.id} />
                        <label className="qv-toggle-card">
                          <input
                            type="checkbox"
                            name="is_public"
                            value="true"
                            defaultChecked={publicProfile?.is_public ?? false}
                            className="qv-toggle-checkbox"
                          />
                          <span className="qv-toggle-copy">
                            <span className="qv-toggle-title">Show this officer publicly</span>
                            <span className="qv-toggle-text">Visitors will see this officer on the public Officers page.</span>
                          </span>
                        </label>

                        {hasPreferredName ? (
                          <label className="qv-toggle-card">
                            <input
                              type="checkbox"
                              name="use_preferred_name"
                              value="true"
                              defaultChecked={usePreferredName}
                              className="qv-toggle-checkbox"
                            />
                            <span className="qv-toggle-copy">
                              <span className="qv-toggle-title">Use preferred name</span>
                              <span className="qv-toggle-text">
                                Use {preferredLabel} instead of the official name{officialLabel ? ` (${officialLabel})` : ''}, unless a custom display name is entered below.
                              </span>
                            </span>
                          </label>
                        ) : (
                          <input type="hidden" name="use_preferred_name" value="true" />
                        )}

                        <div className="qv-form-row qv-form-row-2">
                          <label className="qv-control">
                            <span className="qv-label">Display name optional</span>
                            <input name="display_name_override" defaultValue={customNameValue} placeholder={preferredLabel} />
                          </label>
                          <label className="qv-control">
                            <span className="qv-label">Public title optional</span>
                            <input name="public_title_override" defaultValue={publicProfile?.public_title_override ?? ''} placeholder={formatOfficerLabel(profile.term)} />
                          </label>
                        </div>

                        <div className="qv-form-row qv-form-row-2">
                          <label className="qv-control">
                            <span className="qv-label">Public email optional</span>
                            <input type="email" name="public_email" defaultValue={publicProfile?.public_email ?? ''} placeholder="office@example.org" />
                          </label>
                          <label className="qv-control">
                            <span className="qv-label">Display order</span>
                            <input type="number" min="0" name="sort_order" defaultValue={sortOrder} />
                          </label>
                        </div>

                        <div className="qv-officer-public-actions">
                          <button type="submit" className="qv-button-primary">Save public profile</button>
                        </div>
                      </form>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
