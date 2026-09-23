import Link from 'next/link'
import '../../../../christmas-cards/storefront.css'
import '../../../../christmas-cards/review-order.css'
import '../../../../christmas-cards/us/us-storefront.css'

export const metadata = { title: 'U.S. Order Request Received | Celebrate Christ in Christmas' }

export default async function CcicUsReceivedPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params
  return <main className="ccic-review-page"><section className="ccic-review-empty">
    <p className="ccic-eyebrow">United States</p>
    <h1>Order request received</h1>
    <p>Thank you. Your request <strong>{orderNumber}</strong> has been received and the selected inventory is reserved.</p>
    <p>We’ll calculate your final shipping and import costs within 24 hours whenever possible. In some cases, this may take up to 48 hours.</p>
    <p>When the final amount is ready, we’ll email you a secure link. You’ll have 48 hours from that email to review and confirm your order.</p>
    <p><strong>Please don’t send payment yet.</strong></p>
    <Link className="ccic-review-primary-link" href="/ccic/us">Return to the U.S. card shop</Link>
  </section></main>
}
