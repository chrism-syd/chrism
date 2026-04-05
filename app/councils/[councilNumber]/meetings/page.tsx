import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import OrganizationAvatar from '@/app/components/organization-avatar'
import MeetingKindFilter, { type PublicMeetingKindFilter } from './meeting-kind-filter'
import { formatMeetingDateTimeRange, getEventKindLabel } from '@/lib/events/meetings'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import { createAdminClient } from '@/lib/supabase/admin'

type MeetingsPageProps = {
  params: Promise<{ councilNumber: string }>
  searchParams: Promise<{ kind?: string | string[]; meetingKind?: string | string[] }>
}

type MeetingRow = {
  id: string
  title: string
  description: string | null
  location_name: string | null
  location_address: string | null
  starts_at: string
  ends_at: string
  event_kind_code: 'general_meeting' | 'executive_meeting'
  updated_at: string
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function normalizeKindFilter(value: string | string[] | undefined): PublicMeetingKindFilter {
  const resolved = Array.isArray(value) ? value[0] : value
  if (resolved === 'general' || resolved === 'executive') {
    return resolved
  }
  return 'all'
}

export default async function PublicCouncilMeetingsPage({ params, searchParams }: MeetingsPageProps) {
  const { councilNumber } = await params
  const { kind, meetingKind } = await searchParams
  const selectedKind = normalizeKindFilter(meetingKind ?? kind)
  const supabase = createAdminClient()

  const { data: council } = await supabase
    .from('councils')
    .select('id, name, council_number, organization_id')
    .eq('council_number', councilNumber)
    .maybeSingle()

  if (!council?.id) {
    notFound()
  }

  const meetingsQuery = supabase
    .from('events')
    .select('id, title, description, location_name, location_address, starts_at, ends_at, event_kind_code, updated_at')
    .eq('council_id', council.id)
    .in('event_kind_code', ['general_meeting', 'executive_meeting'])
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true })

  if (selectedKind === 'general') {
    meetingsQuery.eq('event_kind_code', 'general_meeting')
  } else if (selectedKind === 'executive') {
    meetingsQuery.eq('event_kind_code', 'executive_meeting')
  }

  const [{ data: meetings }, { data: organizationData }] = await Promise.all([
    meetingsQuery.returns<MeetingRow[]>(),
    council.organization_id
      ? supabase
          .from('organizations')
          .select('display_name, preferred_name, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)')
          .eq('id', council.organization_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const organization = organizationData as {
    display_name: string | null
    preferred_name: string | null
    logo_storage_path: string | null
    logo_alt_text: string | null
    brand_profile?: {
      code: string | null
      display_name: string | null
      logo_storage_bucket: string | null
      logo_storage_path: string | null
      logo_alt_text: string | null
    } | null
  } | null

  const organizationName = getEffectiveOrganizationName(organization) ?? council.name ?? 'Council'
  const effectiveBranding = getEffectiveOrganizationBranding(organization)
  const councilName = council.name || organizationName || 'Council'
  const feedHref = `/councils/${council.council_number}/meetings.ics`
  const emptyUnitTerm = council.council_number ? 'council' : 'organization'

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <header className="qv-app-header qv-public-page-header">
          <div className="qv-app-header-left">
            <Link href="/" className="qv-brand" aria-label="Chrism home">
              <Image
                src="/Chrism_horiz.svg"
                alt="Chrism"
                width={240}
                height={80}
                className="qv-brand-logo"
                priority
              />
            </Link>
          </div>
        </header>

        <section className="qv-hero-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              {council.council_number ? <p className="qv-eyebrow">Council {council.council_number}</p> : null}
              <div className="qv-directory-title-row">
                <h1 className="qv-directory-name">{councilName}</h1>
              </div>
              <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
                Meeting calendar
              </p>
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
        </section>

        <div className="qv-section-menu-shell qv-public-meetings-menu-shell">
          <div className="qv-public-meetings-menu-row">
            <p className="qv-public-meetings-menu-copy">Add this to your personal calendar</p>
            <Link href={feedHref} className="qv-link-button qv-section-menu-link qv-public-meetings-menu-link">
              Subscribe via ICS
            </Link>
          </div>
        </div>

        <section className="qv-card">
          <div className="qv-directory-section-head qv-public-meetings-head">
            <MeetingKindFilter value={selectedKind} />
          </div>

          {(meetings ?? []).length === 0 ? (
            <div className="qv-empty">
              <p className="qv-empty-title">No meetings have been added to your {emptyUnitTerm} calendar.</p>
              <p className="qv-empty-text">Check back later for the next published General or Executive meeting.</p>
            </div>
          ) : (
            <div className="qv-member-list">
              {(meetings ?? []).map((meeting) => (
                <article key={meeting.id} className="qv-member-row qv-member-row-compact">
                  <div className="qv-member-text">
                    <div className="qv-member-name qv-member-name-tight">{meeting.title}</div>
                    <div className="qv-member-meta qv-member-meta-tight">{getEventKindLabel(meeting.event_kind_code)}</div>
                    <div className="qv-member-meta qv-member-meta-tight">
                      {formatMeetingDateTimeRange(meeting.starts_at, meeting.ends_at)}
                    </div>
                    {meeting.location_name ? (
                      <div className="qv-member-meta qv-member-meta-tight">{meeting.location_name}</div>
                    ) : null}
                    {meeting.location_address ? (
                      <div className="qv-member-meta qv-member-meta-tight">{meeting.location_address}</div>
                    ) : null}
                    {meeting.description ? (
                      <div className="qv-member-meta qv-member-meta-tight">{meeting.description}</div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
