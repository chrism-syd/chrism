import Image from 'next/image'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPeopleRecords } from '@/lib/security/pii'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import {
  getCcicOrderStatusLabel,
  isCcicOrderStatus,
  type CcicOrderStatus,
} from '@/lib/christmas-cards/admin-order-status'
import PackingListPrintButton from './print-button'
import '../../../christmas-cards/admin-orders.css'

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
  fulfillment_method: 'pickup' | 'shipping'
  created_at: string
}

type OrderLine = {
  id: string
  order_id: string
  line_type: 'classic_case' | 'individual_box'
  sku: string
  title: string
  quantity: number
  boxes_per_unit: number
  sort_order: number
}

const PACKING_STATUS_OPTIONS: Array<{
  value: CcicOrderStatus
  label: string
}> = [
  { value: 'received', label: 'Order received' },
  { value: 'paid', label: 'Order paid' },
  { value: 'packed', label: 'Order packed' },
  { value: 'shipped', label: 'Order shipped' },
  { value: 'cancelled', label: 'Cancelled' },
]

const DEFAULT_PACKING_STATUSES: CcicOrderStatus[] = ['received', 'paid', 'packed']
const OPEN_ORDERS_PATH = '/ccic/admin/packing-list?filtered=1&status=received&status=paid&status=packed'

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function stringParams(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeZone: 'America/Toronto',
  }).format(new Date(value))
}

export const metadata = {
  title: 'CCIC Packing List | Chrism',
}

export default async function CcicPackingListPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[]
    filtered?: string | string[]
  }>
}) {
  await requireCcicOrderAdmin('/ccic/admin/packing-list')

  const params = await searchParams
  const hasExplicitFilter = stringParam(params.filtered) === '1'
  const requestedStatuses = stringParams(params.status).filter(isCcicOrderStatus)
  const selectedStatuses = hasExplicitFilter
    ? [...new Set(requestedStatuses)]
    : DEFAULT_PACKING_STATUSES
  const selectedStatusSet = new Set<CcicOrderStatus>(selectedStatuses)

  const admin = createAdminClient()
  const { data: orderData, error: orderError } = await admin
    .from('ccic_orders')
    .select('id, order_number, status_code, contact_name, organization_name, email, cell_phone, address_line_1, address_line_2, city, state_province, postal_code, fulfillment_method, created_at')
    .order('created_at', { ascending: true })

  if (orderError) throw new Error(`Unable to load CCIC packing orders: ${orderError.message}`)

  const allOrders = decryptPeopleRecords((orderData ?? []) as OrderRow[])
  const orders = allOrders.filter((order) => selectedStatusSet.has(order.status_code))
  const orderIds = orders.map((order) => order.id)
  const statusCounts = new Map<CcicOrderStatus, number>()

  for (const order of allOrders) {
    statusCounts.set(order.status_code, (statusCounts.get(order.status_code) ?? 0) + 1)
  }

  let lines: OrderLine[] = []
  if (orderIds.length) {
    const { data: lineData, error: lineError } = await admin
      .from('ccic_order_lines')
      .select('id, order_id, line_type, sku, title, quantity, boxes_per_unit, sort_order')
      .in('order_id', orderIds)
      .order('sort_order', { ascending: true })

    if (lineError) throw new Error(`Unable to load CCIC packing lines: ${lineError.message}`)
    lines = (lineData ?? []) as OrderLine[]
  }

  const linesByOrder = new Map<string, OrderLine[]>()
  const summary = new Map<string, {
    sku: string
    title: string
    lineType: OrderLine['line_type']
    units: number
    boxes: number
  }>()

  for (const line of lines) {
    const orderLines = linesByOrder.get(line.order_id) ?? []
    orderLines.push(line)
    linesByOrder.set(line.order_id, orderLines)

    const key = `${line.line_type}:${line.sku}:${line.title}`
    const current = summary.get(key) ?? {
      sku: line.sku,
      title: line.title,
      lineType: line.line_type,
      units: 0,
      boxes: 0,
    }
    current.units += line.quantity
    current.boxes += line.quantity * line.boxes_per_unit
    summary.set(key, current)
  }

  const summaryLines = [...summary.values()].sort((a, b) => a.title.localeCompare(b.title))
  const totalBoxes = summaryLines.reduce((sum, line) => sum + line.boxes, 0)
  const selectedStatusLabel = selectedStatuses.length === PACKING_STATUS_OPTIONS.length
    ? 'All order statuses'
    : selectedStatuses.length
      ? selectedStatuses.map(getCcicOrderStatusLabel).join(' + ')
      : 'No statuses selected'

  return (
    <main className="ccic-admin-page ccic-packing-page">
      <header className="ccic-admin-header">
        <div className="ccic-admin-heading-brand">
          <Image src="/CCiC.png" alt="Celebrate Christ in Christmas" width={82} height={82} className="ccic-admin-logo" priority />
          <div>
            <p>Celebrate Christ in Christmas</p>
            <h1>Packing list</h1>
          </div>
        </div>
        <div className="ccic-admin-header-actions">
          <Link href="/ccic/admin/orders">View orders</Link>
          <PackingListPrintButton />
        </div>
      </header>

      <section className="ccic-admin-panel ccic-packing-controls no-print">
        <form method="get">
          <input type="hidden" name="filtered" value="1" />
          <strong>Include order statuses</strong>
          {PACKING_STATUS_OPTIONS.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                name="status"
                value={option.value}
                defaultChecked={selectedStatusSet.has(option.value)}
              />
              {option.label} ({statusCounts.get(option.value) ?? 0})
            </label>
          ))}
          <button type="submit">Update packing list</button>
          <a href={OPEN_ORDERS_PATH}>Open orders only</a>
        </form>
        <p>{orders.length} order{orders.length === 1 ? '' : 's'} · {totalBoxes} box{totalBoxes === 1 ? '' : 'es'}</p>
      </section>

      <section className="ccic-admin-panel ccic-packing-summary">
        <div className="ccic-admin-panel-heading">
          <div>
            <p className="ccic-packing-kicker">{selectedStatusLabel}</p>
            <h2>Product totals</h2>
          </div>
          <span>Printed {formatDate(new Date().toISOString())}</span>
        </div>

        {summaryLines.length ? (
          <div className="ccic-admin-table-wrap">
            <table className="ccic-admin-table ccic-packing-summary-table">
              <thead>
                <tr>
                  <th>Card design</th>
                  <th>SKU</th>
                  <th>Type</th>
                  <th>Units</th>
                  <th>Total boxes</th>
                </tr>
              </thead>
              <tbody>
                {summaryLines.map((line) => (
                  <tr key={`${line.lineType}-${line.sku}-${line.title}`}>
                    <td><strong>{line.title}</strong></td>
                    <td>{line.sku}</td>
                    <td>{line.lineType === 'classic_case' ? 'Classic Case' : 'Individual box'}</td>
                    <td>{line.units}</td>
                    <td><strong>{line.boxes}</strong></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Total boxes</td>
                  <td><strong>{totalBoxes}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="ccic-admin-empty">
            <h2>No orders in this view</h2>
            <p>Select one or more order statuses to build a packing list.</p>
          </div>
        )}
      </section>

      {orders.length ? (
        <section className="ccic-packing-orders" aria-label="Order-by-order packing checklist">
          <div className="ccic-packing-section-heading">
            <h2>Order checklist</h2>
            <p>Check each item as it is packed, then update the order status from the order details page.</p>
          </div>

          {orders.map((order) => {
            const orderLines = linesByOrder.get(order.id) ?? []
            const address = [
              order.address_line_1,
              order.address_line_2,
              [order.city, order.state_province].filter(Boolean).join(', '),
              order.postal_code,
            ].filter(Boolean)

            return (
              <article className="ccic-packing-order" key={order.id}>
                <header>
                  <div>
                    <span className="ccic-packing-checkbox" aria-hidden="true" />
                    <div>
                      <h3>{order.order_number}</h3>
                      <p>{order.organization_name}</p>
                    </div>
                  </div>
                  <span className={`ccic-admin-status is-${order.status_code}`}>
                    {getCcicOrderStatusLabel(order.status_code)}
                  </span>
                </header>

                <div className="ccic-packing-order-meta">
                  <div><strong>Contact</strong><span>{order.contact_name}</span></div>
                  <div><strong>Fulfilment</strong><span>{order.fulfillment_method === 'shipping' ? 'Shipping' : 'Pickup'}</span></div>
                  <div><strong>Received</strong><span>{formatDate(order.created_at)}</span></div>
                  {order.fulfillment_method === 'shipping' ? (
                    <div><strong>Ship to</strong><span>{address.length ? address.join(' · ') : 'Address not provided'}</span></div>
                  ) : null}
                </div>

                <ul>
                  {orderLines.map((line) => (
                    <li key={line.id}>
                      <span className="ccic-packing-checkbox" aria-hidden="true" />
                      <span><strong>{line.quantity} × {line.title}</strong><small>{line.sku}</small></span>
                      <strong>{line.quantity * line.boxes_per_unit} box{line.quantity * line.boxes_per_unit === 1 ? '' : 'es'}</strong>
                    </li>
                  ))}
                </ul>

                <Link className="ccic-packing-order-link no-print" href={`/ccic/admin/orders/${order.id}`}>
                  Open order details
                </Link>
              </article>
            )
          })}
        </section>
      ) : null}
    </main>
  )
}
