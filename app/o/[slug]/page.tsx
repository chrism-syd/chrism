import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import OrganizationAvatar from '@/app/components/organization-avatar'
import { bindSaintNames, preventParagraphOrphans } from '@/lib/local-pages/text'
import { getLocalPageTheme, LocalPageThemeStyle } from '@/lib/local-pages/themes'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import { buildCouncilPublicOrgSlug, extractTrailingCouncilNumber } from '@/lib/public-org-slugs'
import { createAdminClient } from '@/lib/supabase/admin'
import { submitPublicContactFormAction } from './actions'
import PublicEvents from './public-events'
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
  const hasPublicContactDetails = Boolean(localUnit?.public_email || localUnit?.public_location_name || publicAddressLines.length > 0)
  const publicEvents = upcomingEvents.map((event) => ({
    id: event.id,
    date: formatShortDate(event.starts_at),
    title: displayText(event.title),
    meta: `${eventKindLabel(event.event_kind_code)} / ${displayText(event.location_name || event.location_address || 'Location to be confirmed')}`,
  }))
  const communityText = paragraph(`${displayName} brings people together through local service, shared responsibility, and simple ways to stay connected to the community.`)

  return (
    <main className={`local-page ${localPageTheme.className}`}>
      <LocalPageThemeStyle theme={localPageTheme} />

      <header className="local-page-header">
        <Link href={`/o/${canonicalSlug}`} className="local-page-header-brand">
          <OrganizationAvatar
            displayName={displayName}
            logoStoragePath={organizationBranding.logo_storage_path}
            logoAltText={organizationBranding.logo_alt_text ?? displayTitle}
            size={68}
          />
          <span className="local-page-header-brand-copy">
            <span className="local-page-header-parent">{parentBrandName}</span>
            <strong className="local-page-header-name">{displayName}</strong>
          </span>
        </Link>
        <nav className="local-page-header-nav">
          <a href="#about">About</a>
          {publicEvents.length > 0 ? <a href="#events">Events</a> : null}
          <a href="#contact">Get involved</a>
        </nav>
        <Link href="/about" className="local-page-chrism-powered" aria-label="About Chrism">
          <Image src="/Chrism_horiz.svg" alt="Chrism" width={92} height={31} priority />
        </Link>
      </header>

      <PublicHero
        displayTitle={displayTitle}
        displayName={displayName}
        subtitle={paragraph(heroSubtitle(displayName))}
        aboutCopy={paragraph(aboutCopy)}
      />

      <PublicEvents events={publicEvents} eventsHref={eventsHref} />

      <PublicStory galleryImages={galleryImages} communityText={communityText} />

      <section id="contact" className="local-page-contact-section">
        <div className="local-page-contact-shell">
          <div className="local-page-contact-grid">
            <div className="local-page-contact-copy">
              <p className="qv-eyebrow">Get involved</p>
              <h2 className="qv-section-title local-page-contact-heading">Interested in what is happening at {displayName}?</h2>
              <p className="qv-section-subtitle local-page-contact-subtitle">
                {paragraph(involvementCopy(organization?.organization_type_code))}
              </p>

              {hasPublicContactDetails ? (
                <div className="local-page-contact-detail-list" aria-label="Public contact details">
                  {localUnit?.public_email ? (
                    <div className="local-page-contact-detail">
                      <span className="local-page-contact-detail-label">Email</span>
                      <span className="local-page-contact-detail-value">
                        <a href={`mailto:${localUnit.public_email}`}>{localUnit.public_email}</a>
                      </span>
                    </div>
                  ) : null}

                  {localUnit?.public_location_name || publicAddressLines.length > 0 ? (
                    <div className="local-page-contact-detail">
                      <span className="local-page-contact-detail-label">Location</span>
                      <span className="local-page-contact-detail-value">
                        {localUnit?.public_location_name ? (
                          localUnit.public_location_url ? (
                            <a href={localUnit.public_location_url} target="_blank" rel="noopener noreferrer">{displayText(localUnit.public_location_name)}</a>
                          ) : (
                            displayText(localUnit.public_location_name)
                          )
                        ) : null}
                      </span>
                      {publicAddressLines.length > 0 ? (
                        <span className="local-page-contact-address-lines">
                          {publicAddressLines.map((line) => (
                            <span key={line}>{displayText(line)}</span>
                          ))}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {externalLinks.length > 0 ? (
                <div className="local-page-contact-links">
                  {externalLinks.map((externalLink) => (
                    <a
                      key={externalLink.id}
                      href={externalLink.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="qv-link-button qv-button-secondary"
                    >
                      {displayText(externalLink.label)}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            {showContactForm ? (
              <div className="local-page-contact-form-card">
                <div>
                  <p className="qv-eyebrow">Contact the council</p>
                  <h3 className="qv-section-title local-page-section-subtitle-tight">Send a message</h3>
                </div>
                <form action={submitPublicContactFormAction} className="qv-form-grid local-page-contact-form">
                  <input type="hidden" name="slug" value={canonicalSlug} />
                  <label className="local-page-visually-hidden-honeypot" aria-hidden="true">
                    Website
                    <input name="website" tabIndex={-1} autoComplete="off" />
                  </label>
                  {contactMessage ? <div className="qv-empty local-page-contact-status">{contactMessage}</div> : null}
                  <div className="qv-form-row qv-form-row-2">
                    <label className="qv-control">
                      <span className="qv-label">Name</span>
                      <input name="name" autoComplete="name" required />
                    </label>
                    <label className="qv-control">
                      <span className="qv-label">Email</span>
                      <input name="email" type="email" autoComplete="email" required />
                    </label>
                  </div>
                  <div className="qv-form-row qv-form-row-2">
                    <label className="qv-control">
                      <span className="qv-label">Phone optional</span>
                      <input name="phone" autoComplete="tel" />
                    </label>
                    <label className="qv-control">
                      <span className="qv-label">Submission type</span>
                      <select name="inquiry_type" defaultValue="general_question">
                        <option value="volunteer">I want to volunteer</option>
                        <option value="membership">I&apos;m interested in joining</option>
                        <option value="general_question">I have a general question</option>
                        <option value="help_request">I need help with something</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                  </div>
                  <label className="qv-control">
                    <span className="qv-label">Message</span>
                    <textarea name="message" rows={4} required />
                  </label>
                  <p className="qv-inline-message">
                    By submitting this form, you agree that this organization may contact you about your submission.
                  </p>
                  <div className="qv-form-actions local-page-form-actions-start">
                    <button type="submit" className="qv-button-primary">Send</button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="local-page-footer">
        <div className="local-page-footer-copy">
          <strong>{displayTitle}</strong>
          <span>{paragraph('Powered by Chrism.')}</span>
        </div>
        <Link href="/about" className="qv-link-button qv-button-secondary">About Chrism</Link>
      </footer>
    </main>
  )
}
