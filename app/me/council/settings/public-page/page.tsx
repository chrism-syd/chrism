import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import ClearFlashMessageCookie from '@/app/components/clear-flash-message-cookie'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { getFlashMessage } from '@/lib/flash-messages'
import { buildCouncilPublicOrgSlug } from '@/lib/public-org-slugs'
import { savePublicExternalLinksAction, updatePublicPageSettingsAction } from './actions'

type OrganizationPublicSettingsRow = {
  id: string
  display_name: string | null
  preferred_name: string | null
  public_page_enabled: boolean | null
  public_description: string | null
  public_contact_form_enabled: boolean | null
}

type ExternalLinkRow = {
  id: string
  label: string
  url: string
  sort_order: number
  is_active: boolean
}

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

  const [{ data: organizationData }, { data: externalLinksData }] = await Promise.all([
    admin
      .from('organizations')
      .select('id, display_name, preferred_name, public_page_enabled, public_description, public_contact_form_enabled')
      .eq('id', permissions.organizationId)
      .maybeSingle(),
    admin
      .from('local_unit_external_links')
      .select('id, label, url, sort_order, is_active')
      .eq('local_unit_id', localUnitId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  const organization = organizationData as OrganizationPublicSettingsRow | null
  const externalLinks = ((externalLinksData as ExternalLinkRow[] | null) ?? []).slice(0, 3)
  const publicSlug = council.council_number
    ? buildCouncilPublicOrgSlug({ name: council.name, councilNumber: council.council_number })
    : null
  const publicPageHref = publicSlug ? `/o/${publicSlug}` : null
  const displayName = organization?.preferred_name ?? organization?.display_name ?? council.name ?? 'your organization'

  return (
    <>
      {shouldClearFlashMessage ? <ClearFlashMessageCookie /> : null}
      <AppHeader />
      <main className="qv-page">
        <div className="qv-shell">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              <p className="qv-eyebrow">Council settings</p>
              <div className="qv-directory-title-row">
                <h1 className="qv-directory-name">Public page</h1>
              </div>
              <p className="qv-subtitle" style={{ marginTop: 10 }}>
                Configure the public-facing front door for {displayName}. This is what people see when they visit the shared Chrism page.
              </p>
            </div>
            <div className="qv-directory-actions">
              <Link href="/me/council" className="qv-link-button qv-button-secondary">Back to council</Link>
              {publicPageHref ? <Link href={publicPageHref} className="qv-link-button qv-button-primary">View public page</Link> : null}
            </div>
          </div>

          {errorMessage ? <div className="qv-form-alert">{errorMessage}</div> : null}
          {noticeMessage ? <div className="qv-empty" style={{ borderStyle: 'solid' }}>{noticeMessage}</div> : null}

          <section className="qv-card">
            <div className="qv-directory-section-head">
              <div>
                <p className="qv-eyebrow">Landing page</p>
                <h2 className="qv-section-title">Page visibility and intro</h2>
                <p className="qv-section-subtitle">
                  Keep this short. The strongest landing page is powered by real org details, upcoming events, and a clear way to get in touch.
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
                  placeholder="A short welcome or description for people visiting your public page."
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
                <p className="qv-eyebrow">Helpful links</p>
                <h2 className="qv-section-title">External links</h2>
                <p className="qv-section-subtitle">
                  Add up to three links. Use them for donations, a Facebook page, a Google Form, a parish site, or anything else worth sending visitors to.
                </p>
              </div>
            </div>

            <form action={savePublicExternalLinksAction} className="qv-form-grid">
              {[0, 1, 2].map((index) => {
                const link = externalLinkAt(externalLinks, index)
                const fieldIndex = index + 1
                return (
                  <div key={fieldIndex} className="qv-form-row qv-form-row-public-links">
                    <label className="qv-control">
                      <span className="qv-label">Link {fieldIndex} label</span>
                      <input
                        name={`external_link_${fieldIndex}_label`}
                        defaultValue={link?.label ?? ''}
                        placeholder={fieldIndex === 1 ? 'Donate' : 'Label'}
                      />
                    </label>
                    <label className="qv-control">
                      <span className="qv-label">Link {fieldIndex} URL</span>
                      <input
                        name={`external_link_${fieldIndex}_url`}
                        defaultValue={link?.url ?? ''}
                        placeholder="https://example.org"
                      />
                    </label>
                  </div>
                )
              })}

              <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
                <button type="submit" className="qv-button-primary">Save external links</button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </>
  )
}
