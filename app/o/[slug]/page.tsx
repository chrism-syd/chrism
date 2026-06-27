import { notFound, redirect } from 'next/navigation'
import { bindSaintNames, preventParagraphOrphans } from '@/lib/local-pages/text'
import { getLocalPageTheme, LocalPageThemeStyle } from '@/lib/local-pages/themes'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import { buildCouncilPublicOrgSlug, extractTrailingCouncilNumber } from '@/lib/public-org-slugs'
import { createAdminClient } from '@/lib/supabase/admin'
import PublicContact from './public-contact'
import PublicEvents from './public-events'
import PublicFooter from './public-footer'
import PublicHeader from './public-header'
import PublicHero from './public-hero'
import PublicStory from './public-story'

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ contact?: string }>
}

type EventRow = {
  id: string
  title: string
  location_name: string | null
  location_address: string | null
  starts_at: string
  ends_at: string | null
  status_code: string
  event_kind_code: 'standard' | 'general_meeting' | 'executive_meeting'
}

type LocalUnitRow = {
  id: string
  public_email: string | null
  public_location_name: string | null
  public_address_line1: string | null
  public_address_line2: string | null
  public_city: string | null
  public_region: string | null
  public_postal_code: string | null
  public_country: string | null
  public_location_url: string | null
}

type ExternalLinkRow = {
  id: string
  label: string
  url: string
  sort_order: number
}

type MessageRouteRow = {
  recipient_email: string | null
  recipient_label: string | null
}

type GalleryImageRow = {
  id: string
  title: string | null
  storage_bucket: string
  storage_path: string
  sort_order: number
}

type PublicGalleryImage = {
  id: string
  title: string | null
  url: string
}

const PUBLIC_GALLERY_MAX_IMAGES = 12

export const dynamic = 'force-dynamic'
export const revalidate = 0

function paragraph(text: string) {
  return preventParagraphOrphans(text)
}

function displayText(text: string | null | undefined) {
  return bindSaintNames(text ?? '')
}

function missionCopy() {
  return 'Empowering Catholic men to live out their faith through charity, unity, and fraternity.'
}

function heroSubtitle(displayName: string) {
  return `${displayName} is a registered not-for-profit local community organization, helping people stay connected through shared service and meaningful community work.`
}

function involvementCopy(code?: string | null) {
  if (code === 'knights_of_columbus') {
    return 'Join the 1.9 million Knights worldwide who lead, serve, protect, and defend. We share a desire to be better husbands, fathers, sons, neighbours, and role models. And to put charity and community first.'
  }

  return 'Attend an event, learn more about this local organization, or get in touch.'
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function eventKindLabel(kind: EventRow['event_kind_code']) {
  if (kind === 'executive_meeting') return 'Executive meeting'
  if (kind === 'general_meeting') return 'General meeting'
  return 'Event'
}

function buildPublicEvents(events: EventRow[]) {
  return events.map((event) => ({
    id: event.id,
    date: formatShortDate(event.starts_at),
    title: displayText(event.title),
    meta: `${eventKindLabel(event.event_kind_code)} / ${displayText(event.location_name || event.location_address || 'Location to be confirmed')}`,
  }))
}

function buildContactDetails(localUnit: LocalUnitRow | null, publicAddressLines: string[]) {
  return [
    ...(localUnit?.public_email
      ? [{ type: 'email' as const, label: 'Email', value: localUnit.public_email, href: `mailto:${localUnit.public_email}` }]
      : []),
    ...(localUnit?.public_location_name || publicAddressLines.length > 0
      ? [
          {
            type: 'location' as const,
            label: 'Location',
            value: localUnit?.public_location_name ? displayText(localUnit.public_location_name) : null,
            href: localUnit?.public_location_url ?? null,
            addressLines: publicAddressLines.map((line) => displayText(line)),
          },
        ]
      : []),
  ]
}

function buildPublicExternalLinks(externalLinks: ExternalLinkRow[]) {
  return externalLinks.map((externalLink) => ({
    id: externalLink.id,
    label: displayText(externalLink.label),
    url: externalLink.url,
  }))
}

function contactStatusMessage(status: string | undefined) {
  if (status === 'sent') {
    return 'Thanks! Your message has been sent to the council.'
  }
  if (status === 'missing') {
    return 'Please include your name, email, and message before sending.'
  }
  if (status === 'error') {
    return 'Sorry, we could not send that message. Please try again later.'
  }
  return null
}

function compactAddressLines(localUnit: LocalUnitRow | null) {
  if (!localUnit) return [] as string[]

  const cityRegionPostal = [localUnit.public_city, localUnit.public_region, localUnit.public_postal_code]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')

  return [
    localUnit.public_address_line1,
    localUnit.public_address_line2,
    cityRegionPostal,
    localUnit.public_country,
  ]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line))
}

export default async function PublicLocalOrganizationPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const contactMessage = contactStatusMessage(resolvedSearchParams.contact)
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
    redirect(`/o/${canonicalSlug}`)
  }

  const [organizationResponse, eventsResponse, localUnitResponse] = await Promise.all([
    council.organization_id
      ? untypedAdmin
          .from('organizations')
          .select('display_name, preferred_name, organization_type_code, public_page_enabled, public_description, public_contact_form_enabled, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)')
          .eq('id', council.organization_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from('events')
      .select('id, title, location_name, location_address, starts_at, ends_at, status_code, event_kind_code')
      .eq('council_id', council.id)
      .eq('status_code', 'scheduled')
      .in('event_kind_code', ['standard', 'general_meeting', 'executive_meeting'])
      .gte('ends_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(4)
      .returns<EventRow[]>(),
    untypedAdmin
      .from('local_units')
      .select('id, public_email, public_location_name, public_address_line1, public_address_line2, public_city, public_region, public_postal_code, public_country, public_location_url')
      .eq('legacy_council_id', council.id)
      .maybeSingle(),
  ])

  const organization = organizationResponse.data as {
    display_name: string | null
    preferred_name: string | null
    organization_type_code: string | null
    public_page_enabled?: boolean | null
    public_description?: string | null
    public_contact_form_enabled?: boolean | null
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

  const localUnit = (localUnitResponse.data as LocalUnitRow | null) ?? null
  const [externalLinksResponse, contactRouteResponse, adminRecipientResponse, galleryResponse] = localUnit?.id
    ? await Promise.all([
        untypedAdmin
          .from('local_unit_external_links')
          .select('id, label, url, sort_order')
          .eq('local_unit_id', localUnit.id)
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
          .limit(3),
        untypedAdmin
          .from('local_unit_message_routes')
          .select('recipient_email, recipient_label')
          .eq('local_unit_id', localUnit.id)
          .eq('route_key', 'public_contact')
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1),
        council.organization_id
          ? admin
              .from('organization_admin_assignments')
              .select('id')
              .eq('organization_id', council.organization_id)
              .eq('is_active', true)
              .limit(1)
          : Promise.resolve({ data: [] }),
        untypedAdmin
          .from('local_unit_public_gallery_images')
          .select('id, title, storage_bucket, storage_path, sort_order')
          .eq('local_unit_id', localUnit.id)
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
          .limit(PUBLIC_GALLERY_MAX_IMAGES),
      ])
    : [
        { data: [] as ExternalLinkRow[] },
        { data: [] as MessageRouteRow[] },
        { data: [] as { id: string }[] },
        { data: [] as GalleryImageRow[] },
      ]

  const organizationName = getEffectiveOrganizationName(organization) ?? council.name ?? 'Local organization'
  const organizationBranding = getEffectiveOrganizationBranding(organization)
  const displayName = displayText(council.name || organizationName)
  const displayTitle = `${displayName}${council.council_number ? ` ${council.council_number}` : ''}`
  const parentBrandName = council.council_number ? 'Knights of Columbus' : displayText(organizationName)
  const eventsHref = `/o/${canonicalSlug}/events`
  const upcomingEvents = eventsResponse.data ?? []
  const externalLinks = (externalLinksResponse.data ?? []) as ExternalLinkRow[]
  const contactRoute = ((contactRouteResponse.data as MessageRouteRow[] | null) ?? [])[0] ?? null
  const hasCustomContactRecipient = Boolean(contactRoute?.recipient_email)
  const hasDefaultAdminRecipient = ((adminRecipientResponse.data as { id: string }[] | null) ?? []).length > 0
  const showContactForm = Boolean(organization?.public_contact_form_enabled !== false && (hasCustomContactRecipient || hasDefaultAdminRecipient))
  const galleryRows = ((galleryResponse.data as GalleryImageRow[] | null) ?? []).slice(0, PUBLIC_GALLERY_MAX_IMAGES)
  const galleryImages = (await Promise.all(
    galleryRows.map(async (image) => {
      const { data } = await admin.storage
        .from(image.storage_bucket)
        .createSignedUrl(image.storage_path, 60 * 60)

      if (!data?.signedUrl) return null

      return {
        id: image.id,
        title: image.title,
        url: data.signedUrl,
      }
    })
  )).filter((image): image is PublicGalleryImage => image !== null)
  const publicDescription = displayText(organization?.public_description)
  const aboutCopy = publicDescription || missionCopy()
  const localPageTheme = getLocalPageTheme({
    organizationTypeCode: organization?.organization_type_code,
    councilNumber: council.council_number,
  })
  const publicAddressLines = compactAddressLines(localUnit)
  const publicEvents = buildPublicEvents(upcomingEvents)
  const communityText = paragraph(`${displayName} brings people together through local service, shared responsibility, and simple ways to stay connected to the community.`)
  const contactDetails = buildContactDetails(localUnit, publicAddressLines)
  const publicExternalLinks = buildPublicExternalLinks(externalLinks)

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
        hasEvents={publicEvents.length > 0}
      />

      <PublicHero
        displayTitle={displayTitle}
        displayName={displayName}
        subtitle={paragraph(heroSubtitle(displayName))}
        aboutCopy={paragraph(aboutCopy)}
      />

      <PublicEvents events={publicEvents} eventsHref={eventsHref} />

      <PublicStory galleryImages={galleryImages} communityText={communityText} />

      <PublicContact
        displayName={displayName}
        involvementText={paragraph(involvementCopy(organization?.organization_type_code))}
        contactDetails={contactDetails}
        externalLinks={publicExternalLinks}
        showContactForm={showContactForm}
        canonicalSlug={canonicalSlug}
        contactMessage={contactMessage}
      />

      <PublicFooter displayTitle={displayTitle} poweredByText={paragraph('Powered by Chrism.')} />
    </main>
  )
}
