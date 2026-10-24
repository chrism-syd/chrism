import { randomUUID } from 'node:crypto'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import { decryptOptionalValue } from '@/lib/security/pii'
import { formatChristmasCardMoney } from '@/lib/christmas-cards/catalog'
import { returnCcicSchoolParentOrderItems } from '../actions'
import '../../../../christmas-cards/admin-orders.css'
import '../school-admin.css'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returned?: string; error?: string }>
}
type ParentOrderLine = {
  id: string
  title: string
  catalog_id: string
  quantity: number
  returned_quantity: number
  unit_price_cents: number
  line_total_cents: number
}
type ReturnEvent = {
  id: string
  created_at: string
  returned_boxes: number
  manual_refund_due_cents: number
  school_contribution_reversed_cents: number
  processed_by: string
  reason: string
  order_fully_returned: boolean
}

const errorMessages: Record<string, string> = {
  'return-confirmation': 'Enter a reason and confirm physical inventory and manual refund handling.',
  'return-failed': 'Return was not completed. The transaction did not partially release inventory. Inspect order and inventory state before retrying.',
  'returns-disabled': 'School-order returns are not enabled for this deployment.',
  'invalid-quantity': 'Choose valid whole-box quantities no higher than the unreturned quantities.',
  'no-returns': 'Enter at least one box to return.',
}

const displayDate = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Toronto' }).format(new Date(value))
  : '—'

export default async function SchoolParentOrderDetails({ params, searchParams }: PageProps) {
  await requireCcicOrderAdmin('/ccic/admin/school-fundraisers')
  const { id } = await params
  const query = await searchParams
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound()

  const admin = createAdminClient()
  const [orderResult, linesResult, returnsResult] = await Promise.all([
    admin.from('ccic_school_orders').select('*').eq('id', id).maybeSingle(),
    admin.from('ccic_school_order_lines')
      .select('id,title,catalog_id,quantity,returned_quantity,unit_price_cents,line_total_cents')
      .eq('order_id', id).order('sort_order'),
    admin.from('ccic_school_order_returns')
      .select('id,created_at,returned_boxes,manual_refund_due_cents,school_contribution_reversed_cents,processed_by,reason,order_fully_returned')
      .eq('order_id', id).order('created_at', { ascending: false }),
  ])
  if (orderResult.error) throw new Error('Unable to load school order')
  if (!orderResult.data) notFound()
  if (linesResult.error) throw new Error('Unable to load school order items')
  if (returnsResult.error) throw new Error('Unable to load order return history')

  const order = orderResult.data
  const items = (linesResult.data ?? []) as ParentOrderLine[]
  const events = (returnsResult.data ?? []) as ReturnEvent[]
  const decode = (value: string | null) => decryptOptionalValue(value) || 'Not provided'
  const originallyOrdered = items.reduce((sum, item) => sum + item.quantity, 0)
  const returnedBoxes = items.reduce((sum, item) => sum + item.returned_quantity, 0)
  const remainingBoxes = originallyOrdered - returnedBoxes
  const returnValueCents = items.reduce((sum, item) => sum + item.returned_quantity * item.unit_price_cents, 0)
  const remainingValueCents = items.reduce((sum, item) => sum + (item.quantity - item.returned_quantity) * item.unit_price_cents, 0)
  const estimatedShareCents = originallyOrdered
    ? Math.round(order.school_contribution_cents * remainingBoxes / originallyOrdered)
    : 0
  // Default OFF. The read-only order history still works when returns are disabled.
  const returnsEnabled = process.env.CCIC_SCHOOL_RETURNS_ENABLED === 'true'
  const canReturn = returnsEnabled && order.status_code === 'paid'
    && Boolean(order.inventory_committed_at)
    && !order.inventory_released_at
    && remainingBoxes > 0
  const hasPartialReturn = returnedBoxes > 0 && remainingBoxes > 0
  const requestKey = randomUUID()


  const totalLabel = order.square_environment === 'sandbox'
    ? 'Test order total'
    : order.status_code === 'paid'
      ? 'Total paid'
      : 'Order total'

  const displayStatus = order.square_environment === 'sandbox'
    ? 'Sandbox test order'
    : hasPartialReturn
      ? 'Partially returned'
      : order.status_code === 'paid'
        ? null
        : order.status_code.replaceAll('_', ' ')

  return (
    <main className="ccic-admin-page ccic-school-order-page">
      <header className="ccic-admin-header">
        <div><p>Order from {order.school_name}</p><h1>{order.order_number}</h1></div>
        <nav className="ccic-admin-header-actions"><Link href="/ccic/admin/school-fundraisers">Back to School Orders</Link></nav>
      </header>

      {query.returned === 'partial' && <p className="ccic-admin-notice">Order partially returned. Only selected mixed-box commitments were released.</p>}
      {query.returned === 'full' && <p className="ccic-admin-notice">This order was fully cancelled and all its mixed-box commitments were released.</p>}
      {query.returned === 'already' && <p className="ccic-admin-notice">This return request was already processed; no inventory was released again.</p>}
      {query.error && errorMessages[query.error] && <p className="ccic-admin-error">{errorMessages[query.error]}</p>}

      <div className="ccic-school-order-layout">
        <div className="ccic-school-order-info-column">
          <section className="ccic-admin-panel ccic-school-order-card">
            <h2>Parent or guardian</h2>
            <dl className="ccic-school-order-facts ccic-school-order-contact-facts">
              <div><dt>Name</dt><dd>{decode(order.parent_name)}</dd></div>
              <div><dt>Email</dt><dd>{decode(order.email)}</dd></div>
              <div><dt>Phone</dt><dd>{decode(order.cell_phone)}</dd></div>
            </dl>
          </section>

          <section className="ccic-admin-panel ccic-school-order-card">
            <h2>Student distribution</h2>
            <dl className="ccic-school-order-facts">
              <div><dt>Student name</dt><dd>{decode(order.student_name)}</dd></div>
              <div><dt>Grade</dt><dd>{order.grade ? decode(order.grade) : 'Not provided'}</dd></div>
              <div><dt>Room</dt><dd>{decode(order.room_number)}</dd></div>
              <div><dt>Teacher</dt><dd>{decode(order.teacher_name)}</dd></div>
            </dl>
          </section>
        </div>

        <section className="ccic-admin-panel ccic-school-order-card ccic-school-order-summary">
          <h2>Order summary</h2>
          {displayStatus && <p className="ccic-school-order-status">{displayStatus}</p>}
          <div className="ccic-school-order-table-wrap">
            <table className="ccic-admin-table">
              <thead><tr><th>Mixed collection</th><th>Ordered</th><th>Returned</th><th>Still to pack</th></tr></thead>
              <tbody>{items.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.quantity}</td>
                  <td>{item.returned_quantity}</td>
                  <td>{item.quantity - item.returned_quantity}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="ccic-school-order-totals">
            <p><strong>{totalLabel}:</strong> {formatChristmasCardMoney(order.total_cents)}</p>
            <p><strong>School contribution:</strong> {formatChristmasCardMoney(estimatedShareCents)}</p>
            {returnedBoxes > 0 && <p><strong>Remaining order value:</strong> {formatChristmasCardMoney(remainingValueCents)}</p>}
          </div>
        <details className="ccic-school-admin-details">
          <summary>View order details</summary>
          <div className="ccic-school-admin-details-body">
            <p><strong>Square environment:</strong> {order.square_environment || 'Not recorded'}</p>
            <p><strong>Original card payment:</strong> {formatChristmasCardMoney(order.total_cents)} (unchanged by returns)</p>
            <p><strong>Remaining order value:</strong> {formatChristmasCardMoney(remainingValueCents)}</p>
            <p><strong>Total manual refund value implied by recorded returns:</strong> {formatChristmasCardMoney(returnValueCents)}</p>
            <p><strong>Remaining school contribution:</strong> {formatChristmasCardMoney(estimatedShareCents)}</p>
            <p><strong>Inventory committed:</strong> {displayDate(order.inventory_committed_at)}</p>
            <p><strong>Most recent return:</strong> {displayDate(order.last_inventory_return_at)}</p>
            <p><strong>All inventory released:</strong> {displayDate(order.inventory_released_at)}</p>
            <p>Refunds are processed separately using Square or the original payment method; recording a return here does not refund a payment.</p>
            {events.length > 0 && (
              <div className="ccic-school-admin-return-history">
                <h3>Order return audit history</h3>
                <ul>{events.map((event) => (
                  <li key={event.id}>
                    {displayDate(event.created_at)} — {event.returned_boxes} mixed box(es) returned; {formatChristmasCardMoney(event.manual_refund_due_cents)} requires manual refund handling.
                    {' '}By {event.processed_by}. Reason: {event.reason}.
                    {event.order_fully_returned ? ' Order fully cancelled.' : ''}
                  </li>
                ))}</ul>
              </div>
            )}
          </div>
        </details>
        </section>
      </div>

      {canReturn && (
        <section className="ccic-admin-panel">
          <details className="ccic-school-admin-details" open={Boolean(query.error && errorMessages[query.error])}>
          <summary>Return or adjust this order</summary>
          <div className="ccic-school-admin-details-body">
          <h2>Return selected boxes from this order</h2>
          <p>Enter the number of boxes to return for each collection. Return one box for a partial adjustment, or all remaining boxes to cancel this order. Other orders and this school's fundraiser are unaffected.</p>
          <form action={returnCcicSchoolParentOrderItems}>
            <input type="hidden" name="order_id" value={order.id} />
            <input type="hidden" name="request_key" value={requestKey} />
            <table className="ccic-admin-table">
              <thead><tr><th>Collection</th><th>Unreturned boxes</th><th>Return now</th></tr></thead>
              <tbody>{items.filter((item) => item.quantity > item.returned_quantity).map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.quantity - item.returned_quantity}</td>
                  <td>
                    <input type="number" name={`return_${item.id}`} min={0} max={item.quantity - item.returned_quantity} step={1} defaultValue={0} required
                      aria-label={`Boxes to return from ${item.title}`} style={{ width: 90, padding: 8 }} />
                  </td>
                </tr>
              ))}</tbody>
            </table>
            <p><label htmlFor="school-return-reason"><strong>Reason for return or cancellation</strong></label></p>
            <textarea id="school-return-reason" name="reason" required minLength={5} maxLength={500} rows={3}
              style={{ width: '100%', maxWidth: 620, padding: 10 }} placeholder="Requested fewer boxes, incorrect order, test-order cleanup, etc." />
            <p><label><input type="checkbox" name="confirm_inventory" value="yes" required />{' '}
              I confirm the returned boxes have not been packed, or their reusable cards are physically back in stock. Release only these boxes' mixed-inventory commitments.</label></p>
            <p><label><input type="checkbox" name="confirm_refund" value="yes" required />{' '}
              I understand that refunds and any customer communications are manual, and the original Square payment record remains unchanged.</label></p>
            <button className="ccic-school-admin-action-button" type="submit">Record return and release selected inventory</button>
          </form>
          </div>
          </details>
        </section>
      )}

      {order.status_code === 'paid' && !returnsEnabled && (
        <section className="ccic-admin-panel"><p>School-order return controls are temporarily disabled during rollout.</p></section>
      )}
      {order.status_code === 'paid' && returnsEnabled && !canReturn && (
        <section className="ccic-admin-panel"><p className="ccic-admin-error">This order's inventory state needs reconciliation before returns can be processed.</p></section>
      )}
      {order.status_code === 'cancelled' && (
        <section className="ccic-admin-panel"><h2>Fully returned school order</h2>
          <p>Cancelled at {displayDate(order.cancelled_at)} by {order.cancelled_by || 'Not recorded'}.</p>
          <p>Square/e-transfer refunds must be processed and documented separately.</p>
        </section>
      )}
    </main>
  )
}
