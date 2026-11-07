import Image from 'next/image'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPeopleRecords } from '@/lib/security/pii'
import { CHRISTMAS_CARD_BOXES, formatChristmasCardMoney } from '@/lib/christmas-cards/catalog'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import {
  CCIC_ORDER_STATUSES,
  CCIC_ORDER_STATUS_LABELS,
  CCIC_ORDER_STATUS_RANK,
  getCcicOrderStatusLabel,
  isCcicOrderStatus,
  type CcicOrderStatus,
} from '@/lib/christmas-cards/admin-order-status'
import '../../../christmas-cards/admin-orders.css'

type OrderRow = {
  id: string
  order_number: string
  status_code: CcicOrderStatus
  contact_name: string
  organization_name: string
  email: string | null
  cell_phone: string | null
  fulfillment_method: 'pickup' | 'shipping'
  total_cents: number
  subtotal_cents: number
  paid_at: string | null
  created_at: string
}

type SortKey = 'order_number' | 'organization_name' | 'contact_name' | 'fulfillment_method' | 'status_code' | 'payment_status' | 'total_cents' | 'created_at'
type SortDirection = 'asc' | 'desc'

const SORT_KEYS = new Set<SortKey>([
  'order_number',
  'organization_name',
  'contact_name',
  'fulfillment_method',
  'status_code',
  'payment_status',
  'total_cents',
  'created_at',
])

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Toronto',
  }).format(new Date(value))
}

function buildSortHref(args: {
  key: SortKey
  currentSort: SortKey
  currentDirection: SortDirection
  status: string
  payment: string
}) {
  const direction: SortDirection = args.currentSort === args.key && args.currentDirection === 'asc'
    ? 'desc'
    : 'asc'
  const params = new URLSearchParams({ sort: args.key, dir: direction })
  if (args.status) params.set('status', args.status)
  if (args.payment) params.set('payment', args.payment)
  return `/ccic/admin/orders?${params.toString()}`
}

function sortOrders(orders: OrderRow[], key: SortKey, direction: SortDirection) {
  const multiplier = direction === 'asc' ? 1 : -1
  return [...orders].sort((a, b) => {
    if (key === 'status_code') {
      return (CCIC_ORDER_STATUS_RANK[a.status_code] - CCIC_ORDER_STATUS_RANK[b.status_code]) * multiplier
    }
    if (key === 'payment_status') {
      const aPaid = a.paid_at ? 1 : 0
      const bPaid = b.paid_at ? 1 : 0
      return (aPaid - bPaid) * multiplier
    }
    if (key === 'total_cents') {
      return (a.total_cents - b.total_cents) * multiplier
    }
    if (key === 'created_at') {
      return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * multiplier
    }

    return String(a[key]).localeCompare(String(b[key]), 'en-CA', {
      numeric: true,
      sensitivity: 'base',
    }) * multiplier
  })
}

function SortHeading({
  label,
  sortKey,
  currentSort,
  currentDirection,
  status,
  payment,
}: {
  label: string
  sortKey: SortKey
  currentSort: SortKey
  currentDirection: SortDirection
  status: string
  payment: string
}) {
  const active = sortKey === currentSort
  return (
    <Link
      className={`ccic-admin-sort${active ? ' is-active' : ''}`}
      href={buildSortHref({ key: sortKey, currentSort, currentDirection, status, payment })}
    >
      {label}
      <span aria-hidden="true">{active ? (currentDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
    </Link>
  )
}

export const metadata = {
  title: 'CCIC Orders | Chrism',
}

export default async function CcicOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    sort?: string | string[]
    dir?: string | string[]
    status?: string | string[]
    payment?: string | string[]
  }>
}) {
  await requireCcicOrderAdmin('/ccic/admin/orders')

  const params = await searchParams
  const requestedSort = stringParam(params.sort)
  const sortKey = requestedSort && SORT_KEYS.has(requestedSort as SortKey)
    ? requestedSort as SortKey
    : 'created_at'
  const sortDirection: SortDirection = stringParam(params.dir) === 'asc' ? 'asc' : 'desc'
  const requestedStatus = stringParam(params.status) || ''
  const statusFilter = isCcicOrderStatus(requestedStatus) ? requestedStatus : ''
  const requestedPayment = stringParam(params.payment) || ''
  const paymentFilter = requestedPayment === 'paid' || requestedPayment === 'awaiting_payment' ? requestedPayment : ''
  const fulfillmentStatuses = CCIC_ORDER_STATUSES.filter((status) => status !== 'paid')

  const admin = createAdminClient()
  const data: OrderRow[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data: page, error } = await admin.from('ccic_orders')
      .select('id, order_number, status_code, contact_name, organization_name, email, cell_phone, fulfillment_method, total_cents, subtotal_cents, paid_at, created_at')
      .order('id').range(offset, offset + 999)
    if (error) throw new Error(`Unable to load CCIC orders: ${error.message}`)
    data.push(...((page ?? []) as OrderRow[]))
    if (!page || page.length < 1000) break
  }

  const activeOrders = ((data ?? []) as OrderRow[]).filter((order) => order.status_code !== 'cancelled')
  const activeIds = activeOrders.map((order) => order.id)
  const boxCounts = { current: 0, previous: 0 }
  const catalog = new Map(CHRISTMAS_CARD_BOXES.map((box) => [box.id, box]))
  for (let start = 0; start < activeIds.length; start += 100) {
    const ids = activeIds.slice(start, start + 100)
    let offset = 0
    while (true) {
      const { data: lines, error: lineError } = await admin.from('ccic_order_lines')
        .select('id, catalog_id, line_type, quantity, boxes_per_unit')
        .in('order_id', ids).order('id').range(offset, offset + 999)
      if (lineError) throw new Error(`Unable to load CCIC order lines: ${lineError.message}`)
      for (const line of lines ?? []) {
        if (line.line_type === 'classic_case') {
          boxCounts.current += line.quantity * line.boxes_per_unit
        } else {
          const box = catalog.get(line.catalog_id)
          if (!box) throw new Error(`Unknown CCIC order item: ${line.catalog_id}`)
          if (!box.isAccessory) {
            if (box.isCasePricingEligible) boxCounts.current += line.quantity * line.boxes_per_unit
            else boxCounts.previous += line.quantity * line.boxes_per_unit
          }
        }
      }
      if (!lines || lines.length < 1000) break
      offset += lines.length
    }
  }
  const totalReceivable = activeOrders.reduce((sum, order) => sum + order.total_cents, 0)
  const merchandiseReceivable = activeOrders.reduce((sum, order) => sum + order.subtotal_cents, 0)

  const decryptedOrders = decryptPeopleRecords((data ?? []) as OrderRow[])
  const workflowFilteredOrders = statusFilter
    ? decryptedOrders.filter((order) => order.status_code === statusFilter)
    : decryptedOrders
  const filteredOrders = paymentFilter
    ? workflowFilteredOrders.filter((order) => paymentFilter === 'paid' ? Boolean(order.paid_at) : !order.paid_at)
    : workflowFilteredOrders
  const orders = sortOrders(filteredOrders, sortKey, sortDirection)

  return (
    <main className="ccic-admin-page">
      <header className="ccic-admin-header">
        <div className="ccic-admin-heading-brand">
          <Image src="/CCiC.png" alt="Celebrate Christ in Christmas" width={82} height={82} className="ccic-admin-logo" priority />
          <div>
            <p>Celebrate Christ in Christmas</p>
            <h1>Orders</h1>
          </div>
        </div>
        <div className="ccic-admin-header-actions">
          <Link href="/ccic/admin/store-control">Store control</Link>
          <Link href="/ccic/admin/packing-list">Packing list</Link>
          <Link href="/ccic/admin/school-fundraisers">Schools</Link>
          <Link href="/ccic">View storefront</Link>
        </div>
      </header>

      <section className="ccic-admin-panel" aria-label="Council sales summary">
        <div className="ccic-admin-panel-heading"><h2>Council sales summary</h2></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
          {[
            ['Current collection boxes', String(boxCounts.current)],
            ['Previous collection boxes', String(boxCounts.previous)],
            ['Including shipping & handling', formatChristmasCardMoney(totalReceivable)],
            ['Excluding shipping & handling', formatChristmasCardMoney(merchandiseReceivable)],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
              <strong style={{ display: 'block', fontSize: 24 }}>{value}</strong><span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ccic-admin-order-controls council-order-filters">
        <form method="get">
          <input type="hidden" name="sort" value={sortKey} />
          <input type="hidden" name="dir" value={sortDirection} />
          <div className="council-order-filter-field"><label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={statusFilter}>
            <option value="">All statuses</option>
            {fulfillmentStatuses.map((status) => (
              <option key={status} value={status}>{CCIC_ORDER_STATUS_LABELS[status]}</option>
            ))}
          </select>
          </div>
          <div className="council-order-filter-field"><label htmlFor="payment">Payment</label>
          <select id="payment" name="payment" defaultValue={paymentFilter}>
            <option value="">All payment statuses</option>
            <option value="awaiting_payment">Awaiting payment</option>
            <option value="paid">Paid</option>
          </select>
          </div>
          <button type="submit">Filter orders</button>
          {statusFilter || paymentFilter ? <Link href="/ccic/admin/orders">Clear filters</Link> : null}
        </form>
      </section>

      <section className="ccic-admin-panel">
        <div className="ccic-admin-panel-heading">
          <h2>{statusFilter ? CCIC_ORDER_STATUS_LABELS[statusFilter] : 'All order requests'}</h2>
          <span>{orders.length} order{orders.length === 1 ? '' : 's'}</span>
        </div>

        {orders.length ? (
          <div className="ccic-admin-table-wrap">
            <table className="ccic-admin-table">
              <thead>
                <tr>
                  <th><SortHeading label="Order" sortKey="order_number" currentSort={sortKey} currentDirection={sortDirection} status={statusFilter} payment={paymentFilter} /></th>
                  <th><SortHeading label="Organization" sortKey="organization_name" currentSort={sortKey} currentDirection={sortDirection} status={statusFilter} payment={paymentFilter} /></th>
                  <th><SortHeading label="Contact" sortKey="contact_name" currentSort={sortKey} currentDirection={sortDirection} status={statusFilter} payment={paymentFilter} /></th>
                  <th><SortHeading label="Fulfilment" sortKey="fulfillment_method" currentSort={sortKey} currentDirection={sortDirection} status={statusFilter} payment={paymentFilter} /></th>
                  <th><SortHeading label="Status" sortKey="status_code" currentSort={sortKey} currentDirection={sortDirection} status={statusFilter} payment={paymentFilter} /></th>
                  <th><SortHeading label="Payment" sortKey="payment_status" currentSort={sortKey} currentDirection={sortDirection} status={statusFilter} payment={paymentFilter} /></th>
                  <th><SortHeading label="Total" sortKey="total_cents" currentSort={sortKey} currentDirection={sortDirection} status={statusFilter} payment={paymentFilter} /></th>
                  <th><SortHeading label="Submitted" sortKey="created_at" currentSort={sortKey} currentDirection={sortDirection} status={statusFilter} payment={paymentFilter} /></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td><Link href={`/ccic/admin/orders/${order.id}`}>{order.order_number}</Link></td>
                    <td>{order.organization_name}</td>
                    <td>
                      <strong>{order.contact_name}</strong>
                      <span>{order.email}</span>
                    </td>
                    <td>{order.fulfillment_method === 'shipping' ? 'Shipping' : 'Pickup'}</td>
                    <td>
                      <span className={`ccic-admin-status is-${order.status_code}`}>
                        {getCcicOrderStatusLabel(order.status_code)}
                      </span>
                    </td>
                    <td>
                      <span className={`ccic-admin-status is-payment-${order.paid_at ? 'paid' : 'awaiting'}`}>
                        {order.paid_at ? 'Paid' : 'Awaiting payment'}
                      </span>
                    </td>
                    <td>{formatChristmasCardMoney(order.total_cents)}</td>
                    <td>{formatDate(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ccic-admin-empty">
            <h2>No matching orders</h2>
            <p>Submitted CCIC order requests will appear here.</p>
          </div>
        )}
      </section>
    </main>
  )
}
