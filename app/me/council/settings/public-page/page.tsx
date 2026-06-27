import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import ClearFlashMessageCookie from '@/app/components/clear-flash-message-cookie'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { getFlashMessage } from '@/lib/flash-messages'
import { buildCouncilPublicOrgSlug } from '@/lib/public-org-slugs'
import {
  deletePublicGalleryImageAction,
  savePublicContactRouteAction,
  savePublicExternalLinksAction,
  savePublicGalleryImagesAction,
  updatePublicPageSettingsAction,
  uploadPublicGalleryImagesAction,
} from './actions'
import { savePublicContactDetailsAction } from './contact-details-actions'

type OrganizationPublicSettingsRow = {
  id: string
  display_name: string | null
  preferred_name: string | null
  public_page_enabled: boolean | null
  public_description: string | null
  public_contact_form_enabled: boolean | null
}

type LocalUnitContactDetailsRow = {
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
  is_active: boolean
}

type MessageRouteRow = {
  id: string
  recipient_email: string | null
  recipient_label: string | null
}

type GalleryImageRow = {
  id: string
  title: string | null
  storage_bucket: string
  storage_path: string
  sort_order: number
  is_active: boolean
}

type GalleryImageView = GalleryImageRow & {
  signedUrl: string | null
}

const DEFAULT_PUBLIC_INTRO = 'Empowering Catholic men to live out their faith through charity, unity, and fraternity.'
const PUBLIC_GALLERY_MAX_IMAGES = 12

export const dynamic = 'force-dynamic'
export const revalidate = 0

function externalLinkAt(links: ExternalLinkRow[], index: number) {
  return links[index] ?? null
}

export default async function PublicPageSettingsPage() {
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

  const untypedAdmin = admin as any
  const [
    { data: organizationData },
    { data: localUnitData },
    { data: externalLinksData },
    { data: messageRouteData },
    { data: galleryData },
  ] = await Promise.all([
    untypedAdmin
      .from('organizations')
      .select('id, display_name, preferred_name, public_page_enabled, public_description, public_contact_form_enabled')
      .eq('id', permissions.organizationId)
      .maybeSingle(),
    untypedAdmin
      .from('local_units')
      .select('id, public_email, public_location_name, public_address_line1, public_address_line2, public_city, public_region, public_postal_code, public_country, public_location_url')
      .eq('id', localUnitId)
      .maybeSingle(),
    untypedAdmin
      .from('local_unit_external_links')
      .select('id, label, url, sort_order, is_active')
      .eq('local_unit_id', localUnitId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    untypedAdmin
      .from('local_unit_message_routes')
      .select('id, recipient_email, recipient_label')
      .eq('local_unit_id', localUnitId)
      .eq('route_key', 'public_contact')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1),
    untypedAdmin
      .from('local_unit_public_gallery_images')
      .select('id, title, storage_bucket, storage_path, sort_order, is_active')
      .eq('local_unit_id', localUnitId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(PUBLIC_GALLERY_MAX_IMAGES),
  ])

  const organization = organizationData as OrganizationPublicSettingsRow | null
  const localUnitContactDetails = localUnitData as LocalUnitContactDetailsRow | null
  const externalLinks = ((externalLinksData as ExternalLinkRow[] | null) ?? []).slice(0, 3)
  const messageRoute = ((messageRouteData as MessageRouteRow[] | null) ?? [])[0] ?? null
  const galleryRows = ((galleryData as GalleryImageRow[] | null) ?? []).slice(0, PUBLIC_GALLERY_MAX_IMAGES)
  const galleryImages: GalleryImageView[] = await Promise.all(
    galleryRows.map(async (image) => {
      const { data } = await admin.storage
        .from(image.storage_bucket)
        .createSignedUrl(image.storage_path, 60 * 60)

      return {
        ...image,
        signedUrl: data?.signedUrl ?? null,
      }
    })
  )
  const gallerySlotsRemaining = Math.max(0, PUBLIC_GALLERY_MAX_IMAGES - galleryImages.length)
  const publicSlug = council.council_number
    ? buildCouncilPublicOrgSlug({ name: council.name, councilNumber: council.council_number })
    : null
  const publicPageHref = publicSlug ? `/o/${publicSlug}` : null
  const displayName = organization?.preferred_name ?? organization?.display_name ?? council.name ?? 'your organization'

  return (
    <main className="qv-page">
      <div className="qv-shell">
        {shouldClearFlashMessage ? <ClearFlashMessageCookie /> : null}
        <AppHeader />

        <section
          style={{
            display: 'grid',
            gap: 14,
            paddingTop: 28,
            marginBottom: 18,
          }}
        >
          <p className="qv-eyebrow">Council settings</p>
          <div className="qv-detail-action-row" style={{ alignItems: 'flex-start' }}>
            <div>
              <h1
                className="qv-directory-name"
                style={{
                  margin: 0,
                  fontSize: 'clamp(42px, 6.4vw, 68px)',
                  lineHeight: 0.96,
                  letterSpacing: '-0.04em',
                }}
              >
                Public Page
              </h1>
              <p
                style={{
                  margin: '14px 0 0',
                  maxWidth: '44ch',
                  fontSize: 15,
                  fontWeight: 700,
                  lineHeight: 1.35,
                  color: 'var(--text-secondary)',
                }}
              >
                Configure the public-facing front door for {displayName}.
              </p>
            </div>
            <div className="qv-directory-actions">
              <Link href="/me/council" className="qv-link-button qv-button-secondary">Back to council</Link>
              <Link href="/me/council/settings/public-page/officers" className="qv-link-button qv-button-secondary">Manage public officers</Link>
              {publicPageHref ? <Link href={publicPageHref} className="qv-link-button qv-button-primary">View public page</Link> : null}
            </div>
          </div>
        </section>

        {errorMessage ? <div className="qv-form-alert">{errorMessage}</div> : null}
        {noticeMessage ? <div className="qv-empty" style={{ borderStyle: 'solid' }}>{noticeMessage}</div> : null}

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <p className="qv-eyebrow">Landing page</p>
              <h2 className="qv-section-title">Page visibility and intro</h2>
              <p className="qv-section-subtitle">
                This intro replaces the default copy shown in the yellow card on the public landing page.
              </p>
            </div>
          </div>

          <form action={updatePublicPageSettingsAction} className="qv-form-grid">
            <div className="qv-form-row qv-form-row-2">
              <label className="qv-toggle-card">
                <input
                  type="checkbox"
                  name="public_page_enabled"
                  value="true"
                  defaultChecked={organization?.public_page_enabled ?? true}
                  className="qv-toggle-checkbox"
                />
                <span className="qv-toggle-copy">
                  <span className="qv-toggle-title">Public page enabled</span>
                  <span className="qv-toggle-text">Let people visit this organization’s public Chrism page.</span>
                </span>
              </label>

              <label className="qv-toggle-card">
                <input
                  type="checkbox"
                  name="public_contact_form_enabled"
                  value="true"
                  defaultChecked={organization?.public_contact_form_enabled ?? true}
                  className="qv-toggle-checkbox"
                />
                <span className="qv-toggle-copy">
                  <span className="qv-toggle-title">Contact form enabled</span>
                  <span className="qv-toggle-text">Show the get-involved form once message routing is configured.</span>
                </span>
              </label>
            </div>

            <label className="qv-control">
              <span className="qv-label">Public intro</span>
              <textarea
                name="public_description"
                rows={5}
                defaultValue={organization?.public_description ?? ''}
                placeholder={DEFAULT_PUBLIC_INTRO}
              />
            </label>

            <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
              <button type="submit" className="qv-button-primary">Save public page settings</button>
            </div>
          </form>
        </section>

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <p className="qv-eyebrow">Council profile</p>
              <h2 className="qv-section-title">Public contact details</h2>
              <p className="qv-section-subtitle">
                These details describe the local organization itself. They can appear on the public page and will later live with the main council profile settings.
              </p>
            </div>
          </div>

          <form action={savePublicContactDetailsAction} className="qv-form-grid">
            <div className="qv-form-row qv-form-row-2">
              <label className="qv-control">
                <span className="qv-label">Public email</span>
                <input
                  name="public_email"
                  type="email"
                  defaultValue={localUnitContactDetails?.public_email ?? ''}
                  placeholder="hello@example.org"
                />
              </label>
              <label className="qv-control">
                <span className="qv-label">Location name</span>
                <input
                  name="public_location_name"
                  defaultValue={localUnitContactDetails?.public_location_name ?? ''}
                  placeholder="St. Patrick’s Parish"
                />
              </label>
            </div>

            <label className="qv-control">
              <span className="qv-label">Address line 1</span>
              <input
                name="public_address_line1"
                defaultValue={localUnitContactDetails?.public_address_line1 ?? ''}
                placeholder="5633 Highway 7"
              />
            </label>

            <label className="qv-control">
              <span className="qv-label">Address line 2 optional</span>
              <input
                name="public_address_line2"
                defaultValue={localUnitContactDetails?.public_address_line2 ?? ''}
                placeholder="Room, hall, building, or care of"
              />
            </label>

            <div className="qv-form-row qv-form-row-public-links">
              <label className="qv-control">
                <span className="qv-label">City</span>
                <input name="public_city" defaultValue={localUnitContactDetails?.public_city ?? ''} placeholder="Markham" />
              </label>
              <label className="qv-control">
                <span className="qv-label">Province / region</span>
                <input name="public_region" defaultValue={localUnitContactDetails?.public_region ?? ''} placeholder="Ontario" />
              </label>
              <label className="qv-control">
                <span className="qv-label">Postal code</span>
                <input name="public_postal_code" defaultValue={localUnitContactDetails?.public_postal_code ?? ''} placeholder="L3P 1B6" />
              </label>
            </div>

            <div className="qv-form-row qv-form-row-2">
              <label className="qv-control">
                <span className="qv-label">Country</span>
                <input name="public_country" defaultValue={localUnitContactDetails?.public_country ?? ''} placeholder="Canada" />
              </label>
              <label className="qv-control">
                <span className="qv-label">Location link optional</span>
                <input
                  name="public_location_url"
                  defaultValue={localUnitContactDetails?.public_location_url ?? ''}
                  placeholder="https://maps.google.com/..."
                />
              </label>
            </div>

            <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
              <button type="submit" className="qv-button-primary">Save contact details</button>
            </div>
          </form>
        </section>

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <p className="qv-eyebrow">Links</p>
              <h2 className="qv-section-title">Public links</h2>
              <p className="qv-section-subtitle">Add up to three links for visitors, such as a parish, RSVP form, or donation page.</p>
            </div>
          </div>

          <form action={savePublicExternalLinksAction} className="qv-form-grid">
            {[0, 1, 2].map((index) => {
              const link = externalLinkAt(externalLinks, index)
              return (
                <div key={index} className="qv-form-row qv-form-row-public-links">
                  <input type="hidden" name={`link_${index}_id`} value={link?.id ?? ''} />
                  <label className="qv-control">
                    <span className="qv-label">Label {index + 1}</span>
                    <input name={`link_${index}_label`} defaultValue={link?.label ?? ''} placeholder="Parish website" />
                  </label>
                  <label className="qv-control qv-form-row-public-links-url">
                    <span className="qv-label">URL {index + 1}</span>
                    <input name={`link_${index}_url`} defaultValue={link?.url ?? ''} placeholder="https://example.org" />
                  </label>
                  <label className="qv-toggle-card qv-toggle-card-compact">
                    <input
                      type="checkbox"
                      name={`link_${index}_active`}
                      value="true"
                      defaultChecked={link?.is_active ?? false}
                      className="qv-toggle-checkbox"
                    />
                    <span className="qv-toggle-copy">
                      <span className="qv-toggle-title">Show</span>
                      <span className="qv-toggle-text">Display this link publicly.</span>
                    </span>
                  </label>
                </div>
              )
            })}

            <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
              <button type="submit" className="qv-button-primary">Save public links</button>
            </div>
          </form>
        </section>

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <p className="qv-eyebrow">Gallery</p>
              <h2 className="qv-section-title">Public gallery</h2>
              <p className="qv-section-subtitle">Add photos that show the life and service of this organization. Up to {PUBLIC_GALLERY_MAX_IMAGES} active photos can be shown publicly.</p>
            </div>
          </div>

          <form action={uploadPublicGalleryImagesAction} className="qv-form-grid">
            <label className="qv-control">
              <span className="qv-label">Upload gallery images</span>
              <input
                type="file"
                name="gallery_images"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={gallerySlotsRemaining <= 0}
              />
            </label>
            <p className="qv-section-subtitle" style={{ margin: 0 }}>
              {gallerySlotsRemaining > 0
                ? `${gallerySlotsRemaining} gallery slot${gallerySlotsRemaining === 1 ? '' : 's'} remaining.`
                : 'The public gallery is full. Remove an image before uploading another.'}
            </p>
            <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
              <button type="submit" className="qv-button-secondary" disabled={gallerySlotsRemaining <= 0}>Upload images</button>
            </div>
          </form>

          {galleryImages.length > 0 ? (
            <div className="qv-public-gallery-settings-grid">
              {galleryImages.map((image) => (
                <article key={image.id} className="qv-public-gallery-settings-card">
                  {image.signedUrl ? <img src={image.signedUrl} alt={image.title ?? 'Public gallery image'} /> : null}
                  <form action={savePublicGalleryImagesAction} className="qv-form-grid">
                    <input type="hidden" name="image_id" value={image.id} />
                    <label className="qv-control">
                      <span className="qv-label">Image title optional</span>
                      <input name="title" defaultValue={image.title ?? ''} placeholder="Council service night" />
                    </label>
                    <label className="qv-control">
                      <span className="qv-label">Display order</span>
                      <input type="number" name="sort_order" defaultValue={image.sort_order} min="0" />
                    </label>
                    <button type="submit" className="qv-button-secondary">Save image</button>
                  </form>
                  <form action={deletePublicGalleryImageAction}>
                    <input type="hidden" name="image_id" value={image.id} />
                    <button type="submit" className="qv-link-button">Remove image</button>
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <div className="qv-empty" style={{ marginTop: 18 }}>
              <p className="qv-empty-text">No gallery images yet.</p>
            </div>
          )}
        </section>

        <section className="qv-card">
          <div className="qv-directory-section-head">
            <div>
              <p className="qv-eyebrow">Messages</p>
              <h2 className="qv-section-title">Public contact routing</h2>
              <p className="qv-section-subtitle">Choose where contact form messages should go.</p>
            </div>
          </div>

          <form action={savePublicContactRouteAction} className="qv-form-grid">
            <div className="qv-form-row qv-form-row-2">
              <label className="qv-control">
                <span className="qv-label">Recipient email</span>
                <input type="email" name="recipient_email" defaultValue={messageRoute?.recipient_email ?? ''} placeholder="grandknight@example.org" />
              </label>
              <label className="qv-control">
                <span className="qv-label">Recipient label optional</span>
                <input name="recipient_label" defaultValue={messageRoute?.recipient_label ?? ''} placeholder="Grand Knight" />
              </label>
            </div>

            <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
              <button type="submit" className="qv-button-primary">Save contact routing</button>
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}
