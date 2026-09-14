import Image from 'next/image'
import Link from 'next/link'
import ReviewOrderForm from '../../christmas-cards/review-order-form'
import '../../christmas-cards/storefront.css'
import '../../christmas-cards/payment-polish.css'
import '../../christmas-cards/storefront-redesign.css'
import '../../christmas-cards/storefront-header-polish.css'
import '../../christmas-cards/storefront-cart-drawer.css'
import '../../christmas-cards/storefront-review-polish.css'
import '../../christmas-cards/storefront-inventory.css'
import '../../christmas-cards/storefront-final-polish.css'
import '../../christmas-cards/review-order.css'

export const metadata = {
  title: 'Review Your Christmas Card Order | Celebrate Christ in Christmas',
  description: 'Review and submit your Celebrate Christ in Christmas card order.',
}

export default function CcicReviewPage() {
  return (
    <main className="ccic-review-page">
      <header className="ccic-site-header">
        <div className="ccic-site-header-inner">
          <span aria-hidden="true" className="ccic-header-spacer" />
          <Link href="/ccic" aria-label="Return to Celebrate Christ in Christmas card selection">
            <Image
              src="/CCiC.png"
              alt="Celebrate Christ in Christmas"
              width={176}
              height={176}
              priority
              className="ccic-header-logo"
            />
          </Link>
          <span aria-hidden="true" className="ccic-header-spacer" />
        </div>
      </header>
      <ReviewOrderForm />
    </main>
  )
}
