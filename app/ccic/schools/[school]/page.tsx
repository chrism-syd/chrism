import Image from 'next/image'
import { notFound } from 'next/navigation'
import SchoolStorefrontOrderBuilder from '../../../christmas-cards/school-storefront-order-builder'
import { CcicCartButton, CcicCartProvider } from '../../../christmas-cards/cart-context'
import {
  CHRISTMAS_CARD_BOXES,
  CHRISTMAS_CARD_COLLECTIONS,
  CHRISTMAS_CARD_ORDER_CONFIG,
} from '@/lib/christmas-cards/catalog'
import {
  getCcicStoreAvailabilityMap,
  syncCcicStoreInventoryCatalog,
} from '@/lib/christmas-cards/inventory'
import { getCcicSchoolCampaign } from '@/lib/christmas-cards/schools'
import '../../../christmas-cards/storefront.css'
import '../../../christmas-cards/payment-polish.css'
import '../../../christmas-cards/storefront-redesign.css'
import '../../../christmas-cards/storefront-header-polish.css'
import '../../../christmas-cards/storefront-cart-drawer.css'
import '../../../christmas-cards/storefront-review-polish.css'
import '../../../christmas-cards/storefront-inventory.css'
import '../../../christmas-cards/storefront-final-polish.css'
import '../../../christmas-cards/school-storefront.css'

export const dynamic = 'force-dynamic'

const SCHOOL_COLLECTIONS = CHRISTMAS_CARD_COLLECTIONS.filter(
  (collection) => collection.id !== 'catholic-prayer-cards'
)

const SCHOOL_BOXES = CHRISTMAS_CARD_BOXES
  .filter((box) => box.collectionId !== 'catholic-prayer-cards')
  .map((box) => ({ ...box, priceCents: 1500 }))

type PageProps = {
  params: Promise<{ school: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { school: schoolSlug } = await params
  const school = getCcicSchoolCampaign(schoolSlug)

  if (!school) {
    return {
      title: 'School Fundraiser | Celebrate Christ in Christmas',
    }
  }

  return {
    title: `${school.name} Christmas Card Fundraiser | Celebrate Christ in Christmas`,
    description: `Support ${school.name} with the Celebrate Christ in Christmas card fundraiser.`,
  }
}

export default async function CcicSchoolCampaignPage({ params }: PageProps) {
  const { school: schoolSlug } = await params
  const school = getCcicSchoolCampaign(schoolSlug)
  if (!school) notFound()

  await syncCcicStoreInventoryCatalog()
  const inventoryAvailability = await getCcicStoreAvailabilityMap()

  const schoolName = <span style={{ whiteSpace: 'nowrap' }}>{school.name}</span>

  return (
    <CcicCartProvider>
      <main className="ccic-page">
        <header className="ccic-site-header">
          <div className="ccic-site-header-inner">
            <span aria-hidden="true" className="ccic-header-spacer" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <Image
                src="/CCiC.png"
                alt={CHRISTMAS_CARD_ORDER_CONFIG.brandName}
                width={176}
                height={176}
                priority
                className="ccic-header-logo"
              />
              <strong className="ccic-school-fundraiser-title">
                {schoolName} Fundraiser
              </strong>
            </div>
            <CcicCartButton />
          </div>
        </header>

        <section className="ccic-hero-image" aria-label="Christmas card collection preview">
          <div className="ccic-hero-image-wrap">
            <Image
              src="/Cards_Selection_Tile.jpg"
              alt="Selection of Celebrate Christ in Christmas greeting cards"
              fill
              priority
              sizes="100vw"
              className="ccic-hero-image-asset"
            />
          </div>
        </section>

        <section className="ccic-intro">
          <div className="ccic-intro-heading">
            <h1>Christmas Cards That Give Back to Our School.</h1>
            <p>
              Beautiful faith-centred Christmas cards your family can share while supporting {schoolName}.
            </p>
          </div>
        </section>

        <SchoolStorefrontOrderBuilder
          boxes={SCHOOL_BOXES}
          collections={SCHOOL_COLLECTIONS}
          inventoryAvailability={inventoryAvailability}
        />

        <section className="ccic-support-banner" aria-label="School fundraising message">
          <p>
            Thank you for helping keep Christ in Christmas while supporting {schoolName}.
          </p>
        </section>

        <footer className="ccic-footer ccic-footer-powered">
          <div className="ccic-photo-credits" aria-label="Header image credits">
            <p>
              Page Header Background Image credits:
              <br className="ccic-photo-credit-break" />
              <a href="https://unsplash.com/@anniespratt?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Annie Spratt</a>
              {' / '}
              <a href="https://unsplash.com/@joannakosinska?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">Joanna Kosinska</a>
              {' on '}
              <a href="https://unsplash.com">Unsplash</a>
            </p>
          </div>
          <div className="ccic-footer-powered-center ccic-school-footer-partners">
            <a href="https://www.chrismworks.com" aria-label="Visit Chrism">
              <Image src="/Chrism.png" alt="Chrism" width={132} height={57} className="ccic-footer-logo" />
            </a>
            <span className="ccic-school-footer-separator" aria-hidden="true" />
            <a href="https://kofc7689.org" aria-label="Visit Knights of Columbus Council 7689">
              <Image
                src="/organizations/knights-of-columbus-logo.png"
                alt="Knights of Columbus"
                width={180}
                height={72}
                className="ccic-school-kofc-logo"
              />
            </a>
          </div>
        </footer>
      </main>
    </CcicCartProvider>
  )
}
