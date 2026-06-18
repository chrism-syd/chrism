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
      <main className="qv-page-shell">
        <div className="qv-page-container" style={{ display: 'grid', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p className="qv-eyebrow">Council settings</p>
              <h1 className="qv-page-title" style={{ marginBottom: 8 }}>Public page</h1>
              <p className="qv-page-subtitle" style={{ maxWidth: 760 }}>
                Configure the public-facing front door for {displayName}. This is what people see when they visit the shared Chrism page.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/me/council" className="qv-link-button qv-button-secondary">Back to council</Link>
              {publicPageHref ? <Link href={publicPageHref} className="qv-link-button qv-button-primary">View public page</Link> : null}
            </div>
          </div>

          {errorMessage ? <div className="qv-alert qv-alert-error">{errorMessage}</div> : null}
          {noticeMessage ? <div className="qv-alert qv-alert-success">{noticeMessage}</div> : null}

          <section className="qv-card" style={{ display: 'grid', gap: 18 }}>
            <div>
              <p className="qv-eyebrow">Landing page</p>
              <h2 className="qv-section-title" style={{ margin: 0 }}>Page visibility and intro</h2>
              <p className="qv-section-subtitle" style={{ marginTop: 6 }}>
                Keep this short. The strongest landing page is powered by real org details, upcoming events, and a clear way to get in touch.
              </p>
            </div>

            <form action={updatePublicPageSettingsAction} style={{ display: 'grid', gap: 18 }}>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800 }}>
                <input
                  type="checkbox"
                  name="public_page_enabled"
                  value="true"
                  defaultChecked={organization?.public_page_enabled ?? true}
                />
                Public page enabled
              </label>

              <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 800 }}>
                <input
                  type="checkbox"
                  name="public_contact_form_enabled"
                  value="true"
                  defaultChecked={organization?.public_contact_form_enabled ?? true}
                />
                Show contact/get-involved form when message routing is configured
              </label>

              <label style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontWeight: 800 }}>Public intro</span>
                <textarea
                  name="public_description"
                  rows={5}
                  defaultValue={organization?.public_description ?? ''}
                  placeholder="A short welcome or description for people visiting your public page."
                  className="qv-input"
                />
              </label>

              <div>
                <button type="submit" className="qv-button qv-button-primary">Save public page settings</button>
              </div>
            </form>
          </section>

          <section className="qv-card" style={{ display: 'grid', gap: 18 }}>
            <div>
              <p className="qv-eyebrow">Helpful links</p>
              <h2 className="qv-section-title" style={{ margin: 0 }}>External links</h2>
              <p className="qv-section-subtitle" style={{ marginTop: 6 }}>
                Add up to three links. Use them for donations, a Facebook page, a Google Form, a parish site, or anything else worth sending visitors to.
              </p>
            </div>

            <form action={savePublicExternalLinksAction} style={{ display: 'grid', gap: 18 }}>
              {[0, 1, 2].map((index) => {
                const link = externalLinkAt(externalLinks, index)
                const fieldIndex = index + 1
                return (
                  <div key={fieldIndex} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 0.4fr) minmax(260px, 1fr)', gap: 12 }}>
                    <label style={{ display: 'grid', gap: 8 }}>
                      <span style={{ fontWeight: 800 }}>Link {fieldIndex} label</span>
                      <input
                        name={`external_link_${fieldIndex}_label`}
                        defaultValue={link?.label ?? ''}
                        placeholder={fieldIndex === 1 ? 'Donate' : 'Label'}
                        className="qv-input"
                      />
                    </label>
                    <label style={{ display: 'grid', gap: 8 }}>
                      <span style={{ fontWeight: 800 }}>Link {fieldIndex} URL</span>
                      <input
                        name={`external_link_${fieldIndex}_url`}
                        defaultValue={link?.url ?? ''}
                        placeholder="https://example.org"
                        className="qv-input"
                      />
                    </label>
                  </div>
                )
              })}

              <div>
                <button type="submit" className="qv-button qv-button-primary">Save external links</button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </>
  )
}
