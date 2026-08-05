import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPeopleRecords } from '@/lib/security/pii'
import { formatChristmasCardMoney } from '@/lib/christmas-cards/catalog'
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
  created_at: string
}

type SortKey = 'order_number' | 'organization_name' | 'contact_name' | 'fulfillment_method' | 'status_code' | 'total_cents' | 'created_at'
type SortDirection = 'asc' | 'desc'

const SORT_KEYS = new Set<SortKey>([
  'order_number',
  'organization_name',
  'contact_name',
  'fulfillment_method',
  'status_code',
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
}) {
  const direction: SortDirection = args.currentSort === args.key && args.currentDirection === 'asc'
    ? 'desc'
    : 'asc'
  const params = new URLSearchParams({ sort: args.key, dir: direction })
  if (args.status) params.set('status', args.status)
  return `/ccic/admin/orders?${params.toString()}`
}

function sortOrders(orders: OrderRow[], key: SortKey, direction: SortDirection) {
  const multiplier = direction === 'asc' ? 1 : -1
  return [...orders].sort((a, b) => {
    if (key === 'status_code') {
      return (CCIC_ORDER_STATUS_RANK[a.status_code] - CCIC_ORDER_STATUS_RANK[b.status_code]) * multiplier
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
}: {
  label: string
  sortKey: SortKey
  currentSort: SortKey
  currentDirection: SortDirection
  status: string
}) {
  const active = sortKey === currentSort
  return (
    <Link
      className={`ccic-admin-sort${active ? ' is-active' : ''}`}
      href={buildSortHref({ key: sortKey, currentSort, currentDirection, status })}
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

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ccic_orders')
    .select('id, order_number, status_code, contact_name, organization_name, email, cell_phone, fulfillment_method, total_cents, created_at')

  if (error) {
    throw new Error(`Unable to load CCIC orders: ${error.message}`)
  }

  const decryptedOrders = decryptPeopleRecords((data ?? []) as OrderRow[])
  const filteredOrders = statusFilter
    ? decryptedOrders.filter((order) => order.status_code === statusFilter)
    : decryptedOrders
  const orders = sortOrders(filteredOrders, sortKey, sortDirection)

  return (
    <main className="ccic-admin-page">
      <header className="ccic-admin-header">
        <div>
          <p>Celebrate Christ in Christmas</p>
          <h1>Orders</h1>
        </div>
        <div className="ccic-admin-header-actions">
          <Link href="/ccic/admin/packing-list">Packing list</Link>
          <Link href="/ccic">View storefront</Link>
        </div>
      </header>

      <section className="ccic-admin-panel ccic-admin-order-controls">
        <form method="get">
          <input type="hidden" name="sort" value={sortKey} />
          <input type="hidden" name="dir" value={sortDirection} />
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={statusFilter}>
            <option value="">All statuses</option>
            {CCIC_ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>{CCIC_ORDER_STATUS_LABELS[status]}</option>
            ))}
          </select>
          <button type="submit">Filter orders</button>
          {statusFilter ? <Link href="/ccic/admin/orders">Clear filter</Link> : null}
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
                  <th><SortHeading label="Order" sortKey="order_number" currentSort={sortKey} currentDirection={sortDirection} status={statusFilter} /></th>
                  <th><SortHeading label="Organization" sortKey="organization_name" currentSort={sortKey} currentDirection={sortDirection} status={statusFilter} /></th>
                  <th><SortHeading label="Contact" sortKey="contact_name" currentSort={sortKey} currentDirection={sortDirection} status={statusFilter} /></th>
                  <th><SortHeading label="Fulfilment" sortKey="fulfillment_method" currentSort={sortKey} currentDirection={sortDirection} status={statusFilter} /></th>
                  <th><SortHeading label="Status" sortKey="status_code" currentSort={sortKey} currentDirection={sortDirection} status={statusFilter} /></th>
                  <th><SortHeading label="Total" sortKey="total_cents" currentSort={sortKey} currentDirection={sortDirection} status={statusFilter} /></th>
                  <th><SortHeading label="Submitted" sortKey="created_at" currentSort={sortKey} currentDirection={sortDirection} status={statusFilter} /></th>
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
