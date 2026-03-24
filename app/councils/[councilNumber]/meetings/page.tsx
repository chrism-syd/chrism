import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import OrganizationAvatar from '@/app/components/organization-avatar'
import { formatMeetingDateTimeRange, getEventKindLabel } from '@/lib/events/meetings'
import { getEffectiveOrganizationName } from '@/lib/organizations/names'
import { createAdminClient } from '@/lib/supabase/admin'

type MeetingsPageProps = {
  params: Promise<{ councilNumber: string }>
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

export default async function PublicCouncilMeetingsPage({ params }: MeetingsPageProps) {
  const { councilNumber } = await params
  const supabase = createAdminClient()

  const { data: council } = await supabase
    .from('councils')
    .select('id, name, council_number, organization_id')
    .eq('council_number', councilNumber)
    .maybeSingle()

  if (!council?.id) {
    notFound()
  }

  const [{ data: meetings }, { data: organizationData }] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, description, location_name, location_address, starts_at, ends_at, event_kind_code, updated_at')
      .eq('council_id', council.id)
      .in('event_kind_code', ['general_meeting', 'executive_meeting'])
      .gte('ends_at', new Date(new Date().valueOf() - 1000 * 60 * 60 * 24 * 30).toISOString())
      .order('starts_at', { ascending: true })
      .returns<MeetingRow[]>(),
    council.organization_id
      ? supabase
          .from('organizations')
          .select('display_name, preferred_name, logo_storage_path, logo_alt_text')
          .eq('id', council.organization_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const organization = organizationData as {
    display_name: string | null
    preferred_name: string | null
    logo_storage_path: string | null
    logo_alt_text: string | null
  } | null

  const organizationName = getEffectiveOrganizationName(organization) ?? council.name ?? 'Council'
  const councilHeading = `${council.name || 'Council'}${council.council_number ? ` (${council.council_number})` : ''}`
  const feedHref = `/councils/${council.council_number}/meetings.ics`

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <section className="qv-hero-card">
          <div className="qv-hero-top">
            <div className="qv-public-council-hero">
              <div className="qv-public-council-brand">
                <OrganizationAvatar
                  displayName={organizationName}
                  logoStoragePath={organization?.logo_storage_path ?? null}
                  logoAltText={organization?.logo_alt_text ?? organizationName}
                  size={84}
                />
              </div>
              <div>
                <h1 className="qv-title">{councilHeading}</h1>
              </div>
            </div>

            <div className="qv-top-actions">
              <Link href={feedHref} className="qv-link-button qv-button-primary">
                Subscribe via ICS
              </Link>
            </div>
          </div>
        </section>

        <div className="qv-public-brand-row" aria-hidden="true">
          <Image src="/Chrism_horiz.svg" alt="" width={184} height={46} className="qv-public-brand-logo" priority={false} />
        </div>

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <h2 className="qv-section-title">Upcoming meetings</h2>
            </div>
          </div>

          {(meetings ?? []).length === 0 ? (
            <div className="qv-empty">
              <p className="qv-empty-title">No meetings published yet</p>
              <p className="qv-empty-text">Check back after the council adds its next General or Executive meeting.</p>
            </div>
          ) : (
            <div className="qv-member-list">
              {(meetings ?? []).map((meeting) => (
                <article key={meeting.id} className="qv-member-row">
                  <div className="qv-member-text">
                    <div className="qv-member-name">{meeting.title}</div>
                    <div className="qv-member-meta">{getEventKindLabel(meeting.event_kind_code)}</div>
                    <div className="qv-member-meta">{formatMeetingDateTimeRange(meeting.starts_at, meeting.ends_at)}</div>
                    {meeting.location_name ? <div className="qv-member-meta">{meeting.location_name}</div> : null}
                    {meeting.location_address ? <div className="qv-member-meta">{meeting.location_address}</div> : null}
                    {meeting.description ? <div className="qv-member-meta">{meeting.description}</div> : null}
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
