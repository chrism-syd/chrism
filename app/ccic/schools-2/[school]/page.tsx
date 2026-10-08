import Image from 'next/image'
import { notFound } from 'next/navigation'
import SchoolMixedStorefront from '../../../christmas-cards/school-mixed-storefront'
import {
  CHRISTMAS_CARD_BOXES,
  CHRISTMAS_CARD_MIXED_BOXES,
  CHRISTMAS_CARD_ORDER_CONFIG,
} from '@/lib/christmas-cards/catalog'
import { getCcicMixedBoxAvailability } from '@/lib/christmas-cards/inventory'
import { getCcicSchoolCampaign } from '@/lib/christmas-cards/schools'
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
}

export async function generateMetadata({ params }: PageProps) {
  const { school: schoolSlug } = await params
  const school = getCcicSchoolCampaign(schoolSlug)
  return {
    title: school ? `${school.name} Christmas Card Fundraiser | Celebrate Christ in Christmas` : 'School Fundraiser | Celebrate Christ in Christmas',
    description: school ? `Support ${school.name} with mixed Celebrate Christ in Christmas card collections.` : undefined,
  }
}

export default async function CcicSchoolMixedCampaignPage({ params }: PageProps) {
  const { school: schoolSlug } = await params
  const school = getCcicSchoolCampaign(schoolSlug)
  if (!school) notFound()

  const mixedAvailability = await getCcicMixedBoxAvailability()
  const schoolName = <span style={{ whiteSpace: 'nowrap' }}>{school.name}</span>

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

      <section className="ccic-intro">
        <div className="ccic-intro-heading">
          <h1>Christmas Cards That Give Back to Our School.</h1>
          <p>Choose a mixed collection of beautiful faith-centred Christmas cards while supporting {schoolName}.</p>
        </div>
      </section>

      <SchoolMixedStorefront mixedBoxes={CHRISTMAS_CARD_MIXED_BOXES} boxes={CHRISTMAS_CARD_BOXES} availability={mixedAvailability} schoolSlug={school.slug} schoolCode={school.code} schoolName={school.name} />

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
