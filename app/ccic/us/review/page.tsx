import Image from 'next/image'
import Link from 'next/link'
import UsReviewOrderForm from '../../../christmas-cards/us/us-review-order-form'
import '../../../christmas-cards/storefront.css'
import '../../../christmas-cards/payment-polish.css'
import '../../../christmas-cards/storefront-redesign.css'
import '../../../christmas-cards/storefront-header-polish.css'
import '../../../christmas-cards/storefront-cart-drawer.css'
import '../../../christmas-cards/storefront-review-polish.css'
import '../../../christmas-cards/storefront-inventory.css'
import '../../../christmas-cards/storefront-final-polish.css'
import '../../../christmas-cards/review-order.css'
import '../../../christmas-cards/us/us-storefront.css'

export const metadata = {
  title: 'Review Your U.S. Christmas Card Order | Celebrate Christ in Christmas',
  description: 'Review your U.S. Celebrate Christ in Christmas order and estimate shipping.',
}

export default function CcicUsReviewPage() {
  return <main className="ccic-review-page">
    <header className="ccic-site-header"><div className="ccic-site-header-inner"><span aria-hidden="true" className="ccic-header-spacer" /><Link href="/ccic/us" aria-label="Return to the U.S. Celebrate Christ in Christmas card selection"><Image src="/CCiC.png" alt="Celebrate Christ in Christmas" width={176} height={176} priority className="ccic-header-logo" /></Link><span aria-hidden="true" className="ccic-header-spacer" /></div></header>
    <UsReviewOrderForm />
  </main>
}
