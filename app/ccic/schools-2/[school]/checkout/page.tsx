import Image from 'next/image'
import { notFound } from 'next/navigation'
import SchoolCheckoutForm from '@/app/christmas-cards/school-checkout-form'
import { CHRISTMAS_CARD_ORDER_CONFIG } from '@/lib/christmas-cards/catalog'
import { getCcicSchoolCampaign, isCcicSchoolCampaignOpen } from '@/lib/christmas-cards/schools'
import '@/app/christmas-cards/storefront.css'
import '@/app/christmas-cards/school-storefront.css'
import '@/app/christmas-cards/school-checkout.css'

export const dynamic = 'force-dynamic'
type PageProps = { params: Promise<{ school: string }> }

export default async function SchoolCheckoutPage({ params }: PageProps) {
  const { school: schoolSlug } = await params
  const school = getCcicSchoolCampaign(schoolSlug)
  if (!school) notFound()
  return (
    <main className="ccic-page ccic-school-checkout-page">
      <header className="ccic-site-header"><div className="ccic-site-header-inner">
        <span aria-hidden="true" className="ccic-header-spacer" />
        <div className="ccic-school-checkout-brand">
          <Image src="/CCiC.png" alt={CHRISTMAS_CARD_ORDER_CONFIG.brandName} width={130} height={130} priority className="ccic-header-logo" />
          <strong>{school.name} Fundraiser</strong>
        </div>
        <span aria-hidden="true" className="ccic-header-spacer" />
      </div></header>
      <SchoolCheckoutForm schoolSlug={school.slug} schoolCode={school.code} schoolName={school.name} orderingClosed={!isCcicSchoolCampaignOpen(school)} />
    </main>
  )
}
