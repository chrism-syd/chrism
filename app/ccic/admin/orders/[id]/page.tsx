import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPeopleRecord } from '@/lib/security/pii'
import { formatChristmasCardMoney } from '@/lib/christmas-cards/catalog'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import {
  CCIC_ORDER_STATUSES,
  CCIC_ORDER_STATUS_LABELS,
  getCcicOrderStatusLabel,
  type CcicOrderStatus,
} from '@/lib/christmas-cards/admin-order-status'
import { updateCcicOrderStatus } from '../actions'
import CopyCustomerDetails from './copy-customer-details'
import '../../../../christmas-cards/admin-orders.css'

type OrderRow = {
  id: string
  order_number: string
  status_code: CcicOrderStatus
  contact_name: string
  organization_name: string
  email: string | null
  cell_phone: string | null
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state_province: string | null
  postal_code: string | null
  country_code: string | null
  fulfillment_method: 'pickup' | 'shipping'
  regular_subtotal_cents: number
  custom_case_count: number
  custom_case_discount_cents: number
  subtotal_cents: number
  shipping_cents: number
  total_cents: number
  currency_code: string
  confirmation_email_sent_at: string | null
  admin_email_sent_at: string | null
  email_error: string | null
  paid_at: string | null
  packed_at: string | null
  shipped_at: string | null
  created_at: string
  updated_at: string
}

type OrderLine = {
  id: string
  line_type: 'classic_case' | 'individual_box'
  sku: string
  title: string
  quantity: number
  unit_price_cents: number
  line_total_cents: number
  boxes_per_unit: number
  sort_order: number
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatDate(value: string | null) {
  if (!value) return 'Not yet'
  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Toronto',
  }).format(new Date(value))
}

export const metadata = { title: 'CCIC Order Details | Chrism' }

export default async function CcicOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ updated?: string | string[]; error?: string | string[] }>
}) {
  const { id } = await params
  await requireCcicOrderAdmin(`/ccic/admin/orders/${id}`)
  const query = await searchParams
  const updated = stringParam(query.updated) === '1'
  const errorCode = stringParam(query.error)

  const admin = createAdminClient()
  const [{ data: orderData, error: orderError }, { data: lineData, error: lineError }] = await Promise.all([
    admin.from('ccic_orders').select('*').eq('id', id).maybeSingle(),
    admin.from('ccic_order_lines').select('*').eq('order_id', id).order('sort_order'),
  ])

  if (orderError) throw new Error(`Unable to load CCIC order: ${orderError.message}`)
  if (lineError) throw new Error(`Unable to load CCIC order lines: ${lineError.message}`)
  if (!orderData) notFound()

  const order = decryptPeopleRecord(orderData as OrderRow)
  const lines = (lineData ?? []) as OrderLine[]
  const address = [order.address_line_1, order.address_line_2, [order.city, order.state_province].filter(Boolean).join(', '), order.postal_code].filter(Boolean) as string[]
  const shippingPending = order.fulfillment_method === 'shipping' && order.shipping_cents === 0

  return (
    <main className="ccic-admin-page">
      <header className="ccic-admin-header">
        <div className="ccic-admin-heading-brand">
          <Image src="/CCiC.png" alt="Celebrate Christ in Christmas" width={82} height={82} className="ccic-admin-logo" priority />
          <div><p>CCIC order</p><h1>{order.order_number}</h1></div>
        </div>
        <div className="ccic-admin-header-actions">
          <Link href="/ccic/admin/packing-list">Packing list</Link>
          <Link href="/ccic/admin/orders">Back to all orders</Link>
        </div>
      </header>

      {updated ? <p className="ccic-admin-notice">Order status updated.</p> : null}
      {errorCode ? <p className="ccic-admin-error">The order status could not be updated. Please try again.</p> : null}

      <div className="ccic-admin-detail-grid">
        <div className="ccic-admin-detail-main">
          <section className="ccic-admin-panel ccic-admin-status-panel">
            <div className="ccic-admin-panel-heading">
              <h2>Order status</h2>
              <span className={`ccic-admin-status is-${order.status_code}`}>{getCcicOrderStatusLabel(order.status_code)}</span>
            </div>
            <form action={updateCcicOrderStatus} className="ccic-admin-status-form">
              <input type="hidden" name="order_id" value={order.id} />
              <label htmlFor="status">Update workflow status</label>
              <div>
                <select id="status" name="status" defaultValue={order.status_code}>
                  {CCIC_ORDER_STATUSES.map((status) => <option key={status} value={status}>{CCIC_ORDER_STATUS_LABELS[status]}</option>)}
                </select>
                <button type="submit">Save status</button>
              </div>
            </form>
            <dl className="ccic-admin-workflow-dates">
              <div><dt>Received</dt><dd>{formatDate(order.created_at)}</dd></div>
              <div><dt>Paid</dt><dd>{formatDate(order.paid_at)}</dd></div>
              <div><dt>Packed</dt><dd>{formatDate(order.packed_at)}</dd></div>
              <div><dt>Shipped</dt><dd>{formatDate(order.shipped_at)}</dd></div>
            </dl>
          </section>

          <section className="ccic-admin-panel">
            <div className="ccic-admin-panel-heading">
              <h2>Order items</h2>
              <span>{lines.reduce((sum, line) => sum + line.quantity * line.boxes_per_unit, 0)} boxes</span>
            </div>
            <div className="ccic-admin-order-lines">
              {lines.map((line) => (
                <div key={line.id}>
                  <span><strong>{line.quantity} × {line.title}</strong><small>{line.sku} · {line.line_type === 'classic_case' ? `${line.boxes_per_unit} boxes per case` : 'Individual box'}</small></span>
                  <strong>{formatChristmasCardMoney(line.line_total_cents)}</strong>
                </div>
              ))}
              {order.custom_case_discount_cents ? (
                <div className="ccic-admin-discount">
                  <span>Custom Case pricing ({order.custom_case_count} complete case{order.custom_case_count === 1 ? '' : 's'})</span>
                  <strong>−{formatChristmasCardMoney(order.custom_case_discount_cents)}</strong>
                </div>
              ) : null}
            </div>

            <div className="ccic-admin-totals">
              <div><span>Subtotal</span><strong>{formatChristmasCardMoney(order.subtotal_cents)}</strong></div>
              <div>
                <span>{order.fulfillment_method === 'shipping' ? 'Shipping & Handling' : 'Pickup'}</span>
                <strong>{shippingPending ? 'Not yet priced' : formatChristmasCardMoney(order.shipping_cents)}</strong>
              </div>
              <div className="ccic-admin-total">
                <span>{shippingPending ? 'Current subtotal' : 'Estimated total'}</span>
                <strong>{formatChristmasCardMoney(order.total_cents)}</strong>
              </div>
            </div>
            {shippingPending ? <p className="ccic-admin-email-error">Shipping & Handling still needs to be priced after the order is reviewed for packing. Confirm the final shipping cost with the customer before payment.</p> : null}
          </section>
        </div>

        <aside className="ccic-admin-panel ccic-admin-contact-card">
          <h2>Customer details</h2>
          <CopyCustomerDetails
            organization={order.organization_name}
            contact={order.contact_name}
            email={order.email}
            phone={order.cell_phone}
            addressLines={address}
            showShippingDetails={order.fulfillment_method === 'shipping'}
          />
          <dl>
            <div><dt>Fulfilment</dt><dd>{order.fulfillment_method === 'shipping' ? 'Shipping' : 'Pickup'}</dd></div>
            <div><dt>Submitted</dt><dd>{formatDate(order.created_at)}</dd></div>
            <div><dt>Customer email</dt><dd>{formatDate(order.confirmation_email_sent_at)}</dd></div>
            <div><dt>Admin email</dt><dd>{formatDate(order.admin_email_sent_at)}</dd></div>
          </dl>
          {order.email_error ? <p className="ccic-admin-email-error">Email warning: {order.email_error}</p> : null}
        </aside>
      </div>
    </main>
  )
}
