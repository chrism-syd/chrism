import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPeopleRecords } from '@/lib/security/pii'
import { formatChristmasCardMoney } from '@/lib/christmas-cards/catalog'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import '../../../christmas-cards/admin-orders.css'

type OrderRow = {
  id: string
  order_number: string
  status_code: string
  contact_name: string
  organization_name: string
  email: string | null
  cell_phone: string | null
  fulfillment_method: 'pickup' | 'shipping'
  total_cents: number
  created_at: string
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Toronto',
  }).format(new Date(value))
}

export const metadata = {
  title: 'CCIC Orders | Chrism',
}

export default async function CcicOrdersPage() {
  await requireCcicOrderAdmin('/ccic/admin/orders')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ccic_orders')
    .select('id, order_number, status_code, contact_name, organization_name, email, cell_phone, fulfillment_method, total_cents, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Unable to load CCIC orders: ${error.message}`)
  }

  const orders = decryptPeopleRecords((data ?? []) as OrderRow[])

  return (
    <main className="ccic-admin-page">
      <header className="ccic-admin-header">
        <div>
          <p>Celebrate Christ in Christmas</p>
          <h1>Orders</h1>
        </div>
        <Link href="/ccic">View storefront</Link>
      </header>

      <section className="ccic-admin-panel">
        <div className="ccic-admin-panel-heading">
          <h2>All order requests</h2>
          <span>{orders.length} order{orders.length === 1 ? '' : 's'}</span>
        </div>

        {orders.length ? (
          <div className="ccic-admin-table-wrap">
            <table className="ccic-admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Organization</th>
                  <th>Contact</th>
                  <th>Fulfilment</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Submitted</th>
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
                    <td><span className={`ccic-admin-status is-${order.status_code}`}>{order.status_code}</span></td>
                    <td>{formatChristmasCardMoney(order.total_cents)}</td>
                    <td>{formatDate(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ccic-admin-empty">
            <h2>No orders yet</h2>
            <p>Submitted CCIC order requests will appear here.</p>
          </div>
        )}
      </section>
    </main>
  )
}
