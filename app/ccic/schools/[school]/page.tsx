import { getCcicOrderAdminSession } from '@/lib/christmas-cards/admin'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import SchoolMixedStorefront from '../../../christmas-cards/school-mixed-storefront'
import {
  CHRISTMAS_CARD_BOXES,
  CHRISTMAS_CARD_MIXED_BOXES,
  CHRISTMAS_CARD_ORDER_CONFIG,
} from '@/lib/christmas-cards/catalog'
import { getCcicMixedBoxAvailability } from '@/lib/christmas-cards/inventory'
import { formatCcicSchoolCampaignDate, getCcicSchoolCampaign, isCcicSchoolOrderingEnabled } from '@/lib/christmas-cards/schools'
import '../../../christmas-cards/storefront.css'
import '../../../christmas-cards/payment-polish.css'
import '../../../christmas-cards/storefront-redesign.css'
import '../../../christmas-cards/storefront-header-polish.css'
import '../../../christmas-cards/storefront-inventory.css'
import '../../../christmas-cards/storefront-final-polish.css'
import '../../../christmas-cards/school-storefront.css'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ school: string }>
  searchParams: Promise<{ preview?: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { school: schoolSlug } = await params
  const school = getCcicSchoolCampaign(schoolSlug)
  return {
    title: school ? `${school.name} Christmas Card Fundraiser | Celebrate Christ in Christmas` : 'School Fundraiser | Celebrate Christ in Christmas',
    description: school ? `Support ${school.name} with mixed Celebrate Christ in Christmas card collections.` : undefined,
  }
}

export default async function CcicSchoolMixedCampaignPage({ params, searchParams }: PageProps) {
  const { school: schoolSlug } = await params
  const school = getCcicSchoolCampaign(schoolSlug)
  if (!school) notFound()

  const { preview } = await searchParams
  const previewRequested = preview === 'closed'
  const previewAuthorized = previewRequested && Boolean(await getCcicOrderAdminSession())
  const orderingClosed = previewAuthorized || !isCcicSchoolOrderingEnabled(school)
  const mixedAvailability = orderingClosed ? [] : await getCcicMixedBoxAvailability()
  const beforeOpening = Boolean(school.orderingOpensAt && Date.now() < new Date(school.orderingOpensAt).getTime())
  const demonstrationOnly = school.orderingEnabled !== true
  const schoolName = <span style={{ whiteSpace: school.name.length > 27 ? 'normal' : 'nowrap' }}>{school.name}</span>
  const opensOnLabel = formatCcicSchoolCampaignDate(school.orderingOpensAt)
  const orderByLabel = formatCcicSchoolCampaignDate(school.orderingClosesAt)
  const deliveryByLabel = formatCcicSchoolCampaignDate(school.deliveryBy)

  return (
    <main className="ccic-page">
      <header className="ccic-site-header">
        <div className="ccic-site-header-inner">
          <span aria-hidden="true" className="ccic-header-spacer" />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <Image src="/CCiC.png" alt={CHRISTMAS_CARD_ORDER_CONFIG.brandName} width={176} height={176} priority className="ccic-header-logo" />
            <strong className="ccic-school-fundraiser-title">{schoolName} Fundraiser</strong>
          </div>
          <span aria-hidden="true" className="ccic-header-spacer" />
        </div>
      </header>

      <section className="ccic-hero-image" aria-label="Christmas card collection preview">
        <div className="ccic-hero-image-wrap">
          <Image src="/Cards_Selection_Tile.jpg" alt="Selection of Celebrate Christ in Christmas greeting cards" fill priority sizes="100vw" className="ccic-hero-image-asset" />
        </div>
      </section>

      {!orderingClosed ? <section className="ccic-intro">
        <div className="ccic-intro-heading">
          <h1>Christmas Cards That Give Back to Our School.</h1>
          <p>Choose a mixed collection of beautiful faith-centred Christmas cards while supporting {schoolName}.</p>
          {orderByLabel || deliveryByLabel ? (
            <div className="ccic-school-intro-dates" aria-label="Fundraiser dates">
              {orderByLabel ? <div><span>Order by</span><strong>{orderByLabel}</strong></div> : null}
              {deliveryByLabel ? <div><span>Delivery by</span><strong>{deliveryByLabel}</strong></div> : null}
            </div>
          ) : null}
        </div>
      </section> : null}

      {demonstrationOnly ? (
        <div role="status" style={{ margin: '24px auto', padding: '20px', maxWidth: 960, background: '#fff4db', border: '2px solid #a96d15', borderRadius: 8, color: '#463000', textAlign: 'center' }}>
          <strong>School program preview only</strong>
          <p style={{ margin: '8px 0 0' }}>This school has not yet opened its fundraiser. Browse the collections below to see what the program offers. Orders and payments are not being accepted.</p>
        </div>
      ) : null}

      {beforeOpening && school.orderingEnabled === true ? (
        <section className="ccic-school-campaign-closed" role="status">
          <h2>Ordering opens {opensOnLabel}</h2>
          <p>{school.name} Christmas card ordering begins {opensOnLabel}{orderByLabel ? ` and closes ${orderByLabel}` : ''}.</p>
          {deliveryByLabel ? <p>Cards will be delivered through the school by {deliveryByLabel}.</p> : null}
        </section>
      ) : orderingClosed && !demonstrationOnly ? (
        <section className="ccic-school-campaign-closed" role="status">
          {previewAuthorized ? <p><strong>Admin preview: this campaign is still accepting orders.</strong></p> : null}
          <h2>Thank you for your support!</h2>
          <p>This year's Christmas card fundraising campaign for {school.name} has now closed.</p>
          <p>Thank you to everyone who placed an order and helped support our school community.</p>
          <h3>Still interested in purchasing Christmas cards?</h3>
          <p>Please contact your school to inquire about additional availability. A limited number of boxes may still be available after the campaign closes.</p>
        </section>
      ) : (
        <SchoolMixedStorefront key={school.slug} mixedBoxes={CHRISTMAS_CARD_MIXED_BOXES} boxes={CHRISTMAS_CARD_BOXES} availability={mixedAvailability} schoolSlug={school.slug} schoolCode={school.code} schoolName={school.name} orderingClosed={orderingClosed} demonstrationOnly={demonstrationOnly} />
      )}

      <section className="ccic-support-banner" aria-label="School fundraising message">
        <p>Thank you for helping keep Christ in Christmas while supporting {schoolName}.</p>
      </section>

      <footer className="ccic-footer ccic-footer-powered">
        <div className="ccic-footer-powered-center ccic-school-footer-partners">
          <a href="https://www.chrismworks.com" aria-label="Visit Chrism">
            <Image src="/Chrism.png" alt="Chrism" width={132} height={57} className="ccic-footer-logo" />
          </a>
          <span className="ccic-school-footer-separator" aria-hidden="true" />
          <a href="https://kofc7689.org" aria-label="Visit Knights of Columbus Council 7689">
            <Image src="/organizations/knights-of-columbus-logo.png" alt="Knights of Columbus" width={180} height={72} className="ccic-school-kofc-logo" />
          </a>
        </div>
      </footer>
    </main>
  )
}
