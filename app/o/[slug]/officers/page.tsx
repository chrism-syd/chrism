import { notFound, redirect } from 'next/navigation'
import PortraitFrame from '@/app/components/portrait-frame'
import { bindSaintNames, preventParagraphOrphans } from '@/lib/local-pages/text'
import { getLocalPageTheme, LocalPageThemeStyle } from '@/lib/local-pages/themes'
import { formatOfficerLabel, isOfficerTermActive, type OfficerScopeCode } from '@/lib/members/officer-roles'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import { buildCouncilPublicOrgSlug, extractTrailingCouncilNumber } from '@/lib/public-org-slugs'
import { decryptPeopleRecords } from '@/lib/security/pii'
import { createAdminClient } from '@/lib/supabase/admin'
import PublicFooter from '../public-footer'
import PublicHeader from '../public-header'
import './public-officers.css'

type PageProps = {
  params: Promise<{ slug: string }>
}

type PersonRow = {
  id: string
  first_name: string
  last_name: string
  nickname: string | null
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
  sort_order: number
  photo_storage_bucket: string | null
  photo_storage_path: string | null
  photo_zoom: number | null
  photo_position_x: number | null
  photo_position_y: number | null
}

type PublicOfficerView = {
  id: string
  name: string
  title: string
  email: string | null
  portraitUrl: string | null
  photoZoom: number
  photoPositionX: number
  photoPositionY: number
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function displayText(text: string | null | undefined) {
  return bindSaintNames(text ?? '')
}

function paragraph(text: string) {
  return preventParagraphOrphans(text)
}

function memberName(member: Pick<PersonRow, 'first_name' | 'last_name' | 'nickname'> | null) {
  if (!member) return 'Officer'

  const preferred = member.nickname?.trim()
  const lastName = member.last_name.trim()
  const firstName = member.first_name.trim()

  if (preferred) {
    return `${preferred} ${lastName}`.trim()
  }

  return `${firstName} ${lastName}`.trim()
}

async function signedPortraitUrl(admin: ReturnType<typeof createAdminClient>, officer: PublicOfficerRow) {
  if (!officer.photo_storage_bucket || !officer.photo_storage_path) return null

  const { data } = await admin.storage
    .from(officer.photo_storage_bucket)
    .createSignedUrl(officer.photo_storage_path, 60 * 60)

  return data?.signedUrl ?? null
}

export default async function PublicOfficersPage({ params }: PageProps) {
  const { slug } = await params
  const councilNumber = extractTrailingCouncilNumber(slug)

  if (!councilNumber) notFound()

  const admin = createAdminClient()
  const untypedAdmin = admin as any

  const { data: council } = await admin
    .from('councils')
    .select('id, name, council_number, organization_id')
    .eq('council_number', councilNumber)
    .maybeSingle()

  if (!council?.id) notFound()

  const canonicalSlug = buildCouncilPublicOrgSlug({ name: council.name, councilNumber: council.council_number })
  if (slug !== canonicalSlug) {
    redirect(`/o/${canonicalSlug}/officers`)
  }

  const [organizationResponse, localUnitResponse, eventResponse] = await Promise.all([
    council.organization_id
      ? untypedAdmin
          .from('organizations')
          .select('display_name, preferred_name, organization_type_code, public_page_enabled, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)')
          .eq('id', council.organization_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    untypedAdmin
      .from('local_units')
      .select('id')
      .eq('legacy_council_id', council.id)
      .maybeSingle(),
    admin
      .from('events')
      .select('id')
      .eq('council_id', council.id)
      .eq('status_code', 'scheduled')
      .in('event_kind_code', ['standard', 'general_meeting', 'executive_meeting'])
      .gte('ends_at', new Date().toISOString())
      .limit(1),
  ])

  const organization = organizationResponse.data as {
    display_name: string | null
    preferred_name: string | null
    organization_type_code: string | null
    public_page_enabled?: boolean | null
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

  if (organization?.public_page_enabled === false) notFound()

  const localUnit = localUnitResponse.data as { id: string } | null
  if (!localUnit?.id) notFound()

  const { data: publicOfficerData } = await untypedAdmin
    .from('local_unit_public_officers')
    .select('id, person_officer_term_id, person_id, display_name_override, public_title_override, public_email, sort_order, photo_storage_bucket, photo_storage_path, photo_zoom, photo_position_x, photo_position_y')
    .eq('local_unit_id', localUnit.id)
    .eq('is_public', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  const publicOfficerRows = (publicOfficerData as PublicOfficerRow[] | null) ?? []
  const termIds = publicOfficerRows.map((officer) => officer.person_officer_term_id)
  const personIds = [...new Set(publicOfficerRows.map((officer) => officer.person_id))]
  const [{ data: termData }, { data: personData }] = await Promise.all([
    termIds.length > 0
      ? admin
          .from('person_officer_terms')
          .select('id, person_id, office_scope_code, office_code, office_rank, service_start_year, service_end_year, manual_end_effective_date, office_label')
          .eq('council_id', council.id)
          .in('id', termIds)
      : Promise.resolve({ data: [] as OfficerTermRow[] }),
    personIds.length > 0
      ? admin
          .from('people')
          .select('id, first_name, last_name, nickname')
          .in('id', personIds)
          .is('archived_at', null)
      : Promise.resolve({ data: [] as PersonRow[] }),
  ])

  const terms = ((termData as OfficerTermRow[] | null) ?? []).filter((term) =>
    isOfficerTermActive(term, { useKnightsOfColumbusFraternalYear: true })
  )
  const termById = new Map(terms.map((term) => [term.id, term]))
  const people = decryptPeopleRecords((personData as PersonRow[] | null) ?? [])
  const personById = new Map(people.map((person) => [person.id, person]))
  const officers: PublicOfficerView[] = (await Promise.all(
    publicOfficerRows.map(async (officer) => {
      const term = termById.get(officer.person_officer_term_id)
      if (!term) return null

      const person = personById.get(officer.person_id) ?? null
      const name = displayText(officer.display_name_override ?? memberName(person))
      const title = displayText(officer.public_title_override ?? formatOfficerLabel(term))
      const portraitUrl = await signedPortraitUrl(admin, officer)

      return {
        id: officer.id,
        name,
        title,
        email: officer.public_email,
        portraitUrl,
        photoZoom: Number(officer.photo_zoom ?? 1),
        photoPositionX: Number(officer.photo_position_x ?? 50),
        photoPositionY: Number(officer.photo_position_y ?? 50),
      }
    })
  )).filter((officer): officer is PublicOfficerView => officer !== null)

  const organizationName = getEffectiveOrganizationName(organization) ?? council.name ?? 'Local organization'
  const organizationBranding = getEffectiveOrganizationBranding(organization)
  const displayName = displayText(council.name || organizationName)
  const displayTitle = `${displayName}${council.council_number ? ` ${council.council_number}` : ''}`
  const parentBrandName = council.council_number ? 'Knights of Columbus' : displayText(organizationName)
  const localPageTheme = getLocalPageTheme({
    organizationTypeCode: organization?.organization_type_code,
    councilNumber: council.council_number,
  })
  const hasEvents = ((eventResponse.data as { id: string }[] | null) ?? []).length > 0

  return (
    <main className={`local-page ${localPageTheme.className}`}>
      <LocalPageThemeStyle theme={localPageTheme} />

      <PublicHeader
        canonicalSlug={canonicalSlug}
        displayName={displayName}
        displayTitle={displayTitle}
        parentBrandName={parentBrandName}
        logoStoragePath={organizationBranding.logo_storage_path}
        logoAltText={organizationBranding.logo_alt_text}
        hasEvents={hasEvents}
      />

      <section className="public-officers-main">
        <div className="public-officers-shell">
          <div className="public-officers-hero">
            <p className="public-officers-eyebrow">Leadership</p>
            <h1 className="public-officers-title">Council officers</h1>
            <p className="public-officers-intro">
              {paragraph(`${displayName} is served by local officers who help guide the council’s work, meetings, and community service.`)}
            </p>
          </div>

          {officers.length > 0 ? (
            <div className="public-officers-grid">
              {officers.map((officer) => (
                <article key={officer.id} className="public-officer-card">
                  <div className="public-officer-portrait">
                    <PortraitFrame
                      image={{
                        src: officer.portraitUrl,
                        alt: officer.portraitUrl ? `${officer.name} portrait` : '',
                        zoom: officer.photoZoom,
                        positionX: officer.photoPositionX,
                        positionY: officer.photoPositionY,
                      }}
                      size={220}
                      radius={26}
                      placeholderLabel="Officer portrait"
                    />
                  </div>
                  <div className="public-officer-copy">
                    <p className="public-officer-title">{officer.title}</p>
                    <h2 className="public-officer-name">{officer.name}</h2>
                    {officer.email ? <a className="public-officer-email" href={`mailto:${officer.email}`}>{officer.email}</a> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="public-officers-empty">
              Officers have not been published yet.
            </div>
          )}
        </div>
      </section>

      <PublicFooter displayTitle={displayTitle} poweredByText={paragraph('Powered by Chrism.')} />
    </main>
  )
}
