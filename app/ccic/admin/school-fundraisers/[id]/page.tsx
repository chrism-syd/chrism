import { randomUUID } from 'node:crypto'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import { decryptOptionalValue } from '@/lib/security/pii'
import { formatChristmasCardMoney } from '@/lib/christmas-cards/catalog'
import { returnCcicSchoolParentOrderItems } from '../actions'
import '../../../../christmas-cards/admin-orders.css'
import '../../../../christmas-cards/school-admin.css'

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
    <main className="ccic-admin-page ccic-school-admin">
      <div className="ccic-school-shell">
        <header className="ccic-school-order-header">
          <Link className="ccic-school-breadcrumb" href="/ccic/admin/school-fundraisers">← Back to School Orders</Link>
          <div className="ccic-school-order-title">
            <div>
              <p className="ccic-school-eyebrow">Parent school order</p>
              <h1>{order.order_number}</h1>
              <p className="ccic-school-subtitle">{order.school_name} · {displayDate(order.created_at)}</p>
            </div>
            <span className={'ccic-school-status ' + (hasPartialReturn ? 'is-partial' : order.status_code === 'paid' ? 'is-paid' : order.status_code === 'cancelled' ? 'is-cancelled' : order.status_code === 'pending_payment' ? 'is-pending' : '')}>
              {hasPartialReturn ? 'Partially returned (paid)' : order.status_code.replaceAll('_', ' ')}
            </span>
          </div>
        </header>

        {query.returned === 'partial' && <p className="ccic-admin-notice">Parent order partially returned. Only selected mixed-box commitments were released.</p>}
        {query.returned === 'full' && <p className="ccic-admin-notice">This parent's order was fully cancelled and all its mixed-box commitments were released.</p>}
        {query.returned === 'already' && <p className="ccic-admin-notice">This return request was already processed; no inventory was released again.</p>}
        {query.error && errorMessages[query.error] && <p className="ccic-admin-error">{errorMessages[query.error]}</p>}

        <section className="ccic-school-overview" aria-label="Order summary">
          <div className="ccic-school-metric is-primary"><span>Boxes still on order</span><strong>{remainingBoxes}</strong></div>
          <div className="ccic-school-metric"><span>Remaining order value</span><strong>{formatChristmasCardMoney(remainingValueCents)}</strong></div>
          <div className="ccic-school-metric"><span>Remaining school contribution</span><strong>{formatChristmasCardMoney(estimatedShareCents)}</strong></div>
        </section>

        <div className="ccic-school-detail-layout">
          <div className="ccic-school-detail-stack">
            <section className="ccic-school-panel">
              <div className="ccic-school-panel-header">
                <div><h2>Items in this order</h2><p>What was ordered, returned, and still needs to be packed.</p></div>
              </div>
              <div className="ccic-admin-table-wrap">
                <table className="ccic-admin-table">
                  <thead><tr><th scope="col">Mixed collection</th><th scope="col">Ordered</th><th scope="col">Returned</th><th scope="col">Still to pack</th></tr></thead>
                  <tbody>{items.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.title}</strong></td>
                      <td data-numeric="true">{item.quantity}</td>
                      <td data-numeric="true">{item.returned_quantity}</td>
                      <td data-numeric="true"><strong>{item.quantity - item.returned_quantity}</strong></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>

            <section className="ccic-school-panel">
              <div className="ccic-school-panel-header"><div><h2>Payment and inventory</h2><p>Financial figures are adjusted for recorded returns.</p></div></div>
              <dl className="ccic-school-finance-rows">
                <div><dt>Original payment (unchanged by returns)</dt><dd>{formatChristmasCardMoney(order.total_cents)}</dd></div>
                <div><dt>Value of remaining boxes</dt><dd>{formatChristmasCardMoney(remainingValueCents)}</dd></div>
                <div><dt>Total value of returns recorded</dt><dd>{formatChristmasCardMoney(returnValueCents)}</dd></div>
                <div><dt>Remaining school contribution</dt><dd>{formatChristmasCardMoney(estimatedShareCents)}</dd></div>
              </dl>
              <p className="ccic-school-callout"><strong>Manual refund reminder:</strong> Recording a return releases selected inventory commitments; it does not refund a Square payment or send a customer message. Recorded return value is not a confirmation of a completed or outstanding refund.</p>
              <details className="ccic-school-metadata">
                <summary>Technical details and inventory dates</summary>
                <dl className="ccic-school-info">
                  <div><dt>Square environment</dt><dd>{order.square_environment || 'Not recorded'}</dd></div>
                  <div><dt>Inventory committed</dt><dd>{displayDate(order.inventory_committed_at)}</dd></div>
                  <div><dt>Most recent return</dt><dd>{displayDate(order.last_inventory_return_at)}</dd></div>
                  <div><dt>All inventory released</dt><dd>{displayDate(order.inventory_released_at)}</dd></div>
                </dl>
              </details>
            </section>
          </div>

          <div className="ccic-school-detail-stack">
            <section className="ccic-school-panel">
              <div className="ccic-school-panel-header"><h2>Parent contact</h2></div>
              <dl className="ccic-school-info">
                <div><dt>Parent</dt><dd>{decode(order.parent_name)}</dd></div>
                <div><dt>Email</dt><dd>{decode(order.email)}</dd></div>
                <div><dt>Phone</dt><dd>{decode(order.cell_phone)}</dd></div>
              </dl>
            </section>
            <section className="ccic-school-panel">
              <div className="ccic-school-panel-header"><h2>Student delivery</h2></div>
              <dl className="ccic-school-info">
                <div><dt>Student</dt><dd>{decode(order.student_name)}</dd></div>
                <div><dt>Grade</dt><dd>{order.grade ? decode(order.grade) : 'Not provided'}</dd></div>
                <div><dt>Room</dt><dd>{decode(order.room_number)}</dd></div>
                <div><dt>Teacher</dt><dd>{decode(order.teacher_name)}</dd></div>
              </dl>
            </section>
          </div>
        </div>

        {canReturn && (
          <section className="ccic-school-panel ccic-school-return-panel">
            <div className="ccic-school-panel-header">
              <div>
                <h2>Returns &amp; cancellations</h2>
                <p>Only use this when a parent needs fewer boxes or the whole order cancelled.</p>
              </div>
            </div>
            <details open={Boolean(query.error)}>
              <summary>Record a partial return or full cancellation</summary>
              <p className="ccic-school-helper">Choose the quantities to return, provide a reason, and complete both confirmations. To fully cancel, select every box still remaining. The change affects only this parent order.</p>
              <form action={returnCcicSchoolParentOrderItems}>
                <input type="hidden" name="order_id" value={order.id} />
                <input type="hidden" name="request_key" value={requestKey} />
                <div className="ccic-admin-table-wrap">
                  <table className="ccic-admin-table">
                    <thead><tr><th scope="col">Collection</th><th scope="col">Available to return</th><th scope="col">Return quantity</th></tr></thead>
                    <tbody>{items.filter((item) => item.quantity > item.returned_quantity).map((item) => (
                      <tr key={item.id}>
                        <td>{item.title}</td>
                        <td data-numeric="true">{item.quantity - item.returned_quantity}</td>
                        <td>
                          <input type="number" name={'return_' + item.id} min={0} max={item.quantity - item.returned_quantity} step={1} defaultValue={0} required
                            aria-label={'Boxes to return from ' + item.title} />
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <label htmlFor="school-return-reason"><strong>Reason for return or cancellation</strong>
                  <textarea id="school-return-reason" name="reason" required minLength={5} maxLength={500} rows={3}
                    placeholder="Parent requested fewer boxes, incorrect order, test-order cleanup, etc." />
                </label>
                <label className="ccic-school-confirmation">
                  <input type="checkbox" name="confirm_inventory" value="yes" required />
                  <span>I confirm the returned boxes have not been packed, or their reusable cards are physically back in stock. Release only these boxes' mixed-inventory commitments.</span>
                </label>
                <label className="ccic-school-confirmation">
                  <input type="checkbox" name="confirm_refund" value="yes" required />
                  <span>I understand that refunds and any customer communications are manual, and the original Square payment record remains unchanged.</span>
                </label>
                <button type="submit">Record parent return and release selected inventory</button>
              </form>
            </details>
          </section>
        )}

        {events.length > 0 && (
          <section className="ccic-school-panel">
            <div className="ccic-school-panel-header"><div><h2>Return history</h2><p>Recorded adjustments to this parent's order.</p></div></div>
            <ol className="ccic-school-timeline">
              {events.map((event) => (
                <li key={event.id}>
                  <time dateTime={event.created_at}>{displayDate(event.created_at)}</time>
                  <strong>{event.returned_boxes} mixed box{event.returned_boxes === 1 ? '' : 'es'} returned {event.order_fully_returned ? '· Full cancellation' : ''}</strong>
                  <span>{formatChristmasCardMoney(event.manual_refund_due_cents)} requires manual refund handling. Recorded by {event.processed_by}.</span>
                  <span><strong>Reason:</strong> {event.reason}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {order.status_code === 'paid' && !returnsEnabled && (
          <section className="ccic-school-panel"><p className="ccic-school-helper">Parent-order return controls are temporarily disabled during rollout.</p></section>
        )}
        {order.status_code === 'paid' && returnsEnabled && !canReturn && (
          <section className="ccic-school-panel"><p className="ccic-admin-error">This parent order's inventory state needs reconciliation before returns can be processed.</p></section>
        )}
        {order.status_code === 'cancelled' && (
          <section className="ccic-school-panel">
            <h2>Order fully cancelled</h2>
            <p className="ccic-school-helper">Cancelled at {displayDate(order.cancelled_at)} by {order.cancelled_by || 'Not recorded'}.</p>
            <p className="ccic-school-callout">Square/e-transfer refunds must be processed and documented separately.</p>
          </section>
        )}
      </div>
    </main>
  )
}
