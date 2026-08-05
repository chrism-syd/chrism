import Image from 'next/image'
import Link from 'next/link'
import ReviewOrderForm from '../../christmas-cards/review-order-form'
import '../../christmas-cards/storefront.css'
import '../../christmas-cards/storefront-redesign.css'
import '../../christmas-cards/review-order.css'

export const metadata = {
  title: 'Review Your Christmas Card Order | Celebrate Christ in Christmas',
  description: 'Review and submit your Celebrate Christ in Christmas card order.',
}

export default function CcicReviewPage() {
  return (
    <main className="ccic-review-page">
      <header className="ccic-review-site-header">
        <Link href="/ccic" aria-label="Return to Celebrate Christ in Christmas card selection">
          <Image src="/CCiC.png" alt="Celebrate Christ in Christmas" width={116} height={116} priority />
        </Link>
      </header>
      <ReviewOrderForm />
    </main>
  )
}
