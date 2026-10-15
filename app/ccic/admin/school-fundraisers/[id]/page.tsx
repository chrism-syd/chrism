import { randomUUID } from 'node:crypto'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import { decryptOptionalValue } from '@/lib/security/pii'
import { formatChristmasCardMoney } from '@/lib/christmas-cards/catalog'
import { returnCcicSchoolParentOrderItems } from '../actions'
import '../../../../christmas-cards/admin-orders.css'

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
  'returns-disabled': 'Parent-order returns are not enabled for this deployment.',
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
  if (orderResult.error) throw new Error('Unable to load parent school order')
  if (!orderResult.data) notFound()
  if (linesResult.error) throw new Error('Unable to load parent school order items')
  if (returnsResult.error) throw new Error('Unable to load parent return history')

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

  return (
    <main className="ccic-admin-page">
      <header className="ccic-admin-header">
        <h1>{order.order_number}</h1>
        <Link href="/ccic/admin/school-fundraisers">Back to School Orders</Link>
      </header>

      {query.returned === 'partial' && <p className="ccic-admin-notice">Parent order partially returned. Only selected mixed-box commitments were released.</p>}
      {query.returned === 'full' && <p className="ccic-admin-notice">This parent's order was fully cancelled and all its mixed-box commitments were released.</p>}
      {query.returned === 'already' && <p className="ccic-admin-notice">This return request was already processed; no inventory was released again.</p>}
      {query.error && errorMessages[query.error] && <p className="ccic-admin-error">{errorMessages[query.error]}</p>}

      <section className="ccic-admin-panel">
        <h2>{order.school_name} — Individual parent order</h2>
        <p><strong>Status:</strong> {hasPartialReturn ? 'Partially returned (paid)' : order.status_code.replaceAll('_', ' ')}</p>
        <p><strong>Square environment:</strong> {order.square_environment || 'Not recorded'}</p>
        <p><strong>Parent:</strong> {decode(order.parent_name)}</p>
        <p><strong>Email:</strong> {decode(order.email)}</p>
        <p><strong>Phone:</strong> {decode(order.cell_phone)}</p>
        <h3>Student distribution</h3>
        <p><strong>Name:</strong> {decode(order.student_name)} · <strong>Grade:</strong> {order.grade ? decode(order.grade) : 'Not provided'}</p>
        <p><strong>Room:</strong> {decode(order.room_number)} · <strong>Teacher:</strong> {decode(order.teacher_name)}</p>
        <h3>Items in this parent's order</h3>
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
        <p><strong>Original card payment:</strong> {formatChristmasCardMoney(order.total_cents)} (unchanged by returns)</p>
        <p><strong>Remaining order value:</strong> {formatChristmasCardMoney(remainingValueCents)}</p>
        <p><strong>Total manual refund value implied by recorded returns:</strong> {formatChristmasCardMoney(returnValueCents)}</p>
        <p><strong>Remaining school contribution:</strong> {formatChristmasCardMoney(estimatedShareCents)}</p>
        <p><strong>Inventory committed:</strong> {displayDate(order.inventory_committed_at)}</p>
        <p><strong>Most recent return:</strong> {displayDate(order.last_inventory_return_at)}</p>
        <p><strong>All inventory released:</strong> {displayDate(order.inventory_released_at)}</p>
        <p>Refunds are processed separately using Square or the original payment method; recording a return here does not refund a payment.</p>
      </section>

      {events.length > 0 && (
        <section className="ccic-admin-panel">
          <h2>Parent return audit history</h2>
          <ul>{events.map((event) => (
            <li key={event.id}>
              {displayDate(event.created_at)} — {event.returned_boxes} mixed box(es) returned; {formatChristmasCardMoney(event.manual_refund_due_cents)} requires manual refund handling.
              {' '}By {event.processed_by}. Reason: {event.reason}.
              {event.order_fully_returned ? ' Parent order fully cancelled.' : ''}
            </li>
          ))}</ul>
        </section>
      )}

      {canReturn && (
        <section className="ccic-admin-panel">
          <h2>Return selected boxes from this parent order</h2>
          <p>Enter the number of boxes to return for each collection. Return one box for a partial adjustment, or all remaining boxes to cancel this parent's order. Other parents and this school's fundraiser are unaffected.</p>
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
              style={{ width: '100%', maxWidth: 620, padding: 10 }} placeholder="Parent requested fewer boxes, incorrect order, test-order cleanup, etc." />
            <p><label><input type="checkbox" name="confirm_inventory" value="yes" required />{' '}
              I confirm the returned boxes have not been packed, or their reusable cards are physically back in stock. Release only these boxes' mixed-inventory commitments.</label></p>
            <p><label><input type="checkbox" name="confirm_refund" value="yes" required />{' '}
              I understand that refunds and any customer communications are manual, and the original Square payment record remains unchanged.</label></p>
            <button type="submit">Record parent return and release selected inventory</button>
          </form>
        </section>
      )}

      {order.status_code === 'paid' && !returnsEnabled && (
        <section className="ccic-admin-panel"><p>Parent-order return controls are temporarily disabled during rollout.</p></section>
      )}
      {order.status_code === 'paid' && returnsEnabled && !canReturn && (
        <section className="ccic-admin-panel"><p className="ccic-admin-error">This parent order's inventory state needs reconciliation before returns can be processed.</p></section>
      )}
      {order.status_code === 'cancelled' && (
        <section className="ccic-admin-panel"><h2>Fully returned parent order</h2>
          <p>Cancelled at {displayDate(order.cancelled_at)} by {order.cancelled_by || 'Not recorded'}.</p>
          <p>Square/e-transfer refunds must be processed and documented separately.</p>
        </section>
      )}
    </main>
  )
}
