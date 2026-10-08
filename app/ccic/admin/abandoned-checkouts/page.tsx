import Image from 'next/image'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptPeopleRecords } from '@/lib/security/pii'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import { formatChristmasCardMoney } from '@/lib/christmas-cards/catalog'
import '../../../christmas-cards/admin-orders.css'

type Checkout = {
  id: string
  contact_name: string
  organization_name: string
  email: string
  cell_phone: string | null
  cart_lines: { title: string; quantity: number; line_total_cents: number }[]
  subtotal_cents: number
  shipping_cents: number | null
  shipping_status: string
  total_cents: number
  last_activity_at: string
}
export const metadata = { title: 'Abandoned Checkouts | CCIC' }
export const dynamic = 'force-dynamic'

export default async function AbandonedCheckoutsPage() {
  await requireCcicOrderAdmin('/ccic/admin/abandoned-checkouts')
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const admin = createAdminClient()
  const { data, error } = await admin.from('ccic_abandoned_checkouts')
    .select('id,contact_name,organization_name,email,cell_phone,cart_lines,subtotal_cents,shipping_cents,shipping_status,total_cents,last_activity_at')
    .eq('status', 'active')
    .lte('last_activity_at', cutoff)
    .order('last_activity_at', { ascending: false })
    .limit(200)
  if (error) throw new Error('Unable to load abandoned checkouts: ' + error.message)
  const rows = decryptPeopleRecords((data ?? []) as Checkout[])
  const formatDate = (value: string) => new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Toronto',
  }).format(new Date(value))

  return <main className="ccic-admin-page">
    <header className="ccic-admin-header">
      <div className="ccic-admin-heading-brand">
        <Image src="/CCiC.png" alt="CCIC" width={82} height={82} />
        <div><p>Celebrate Christ in Christmas</p><h1>Abandoned checkouts</h1></div>
      </div>
      <div className="ccic-admin-header-actions">
        <Link href="/ccic/admin/orders">Orders</Link>
        <Link href="/ccic/admin/store-control">Store control</Link>
      </div>
    </header>
    <section className="ccic-admin-panel">
      <div className="ccic-admin-panel-heading">
        <h2>Unsubmitted shipping checkouts</h2>
        <span>{rows.length} checkout{rows.length === 1 ? '' : 's'}</span>
      </div>
      <p>Customers who entered their name and email but did not submit an order within 60 minutes. Shipping prices are estimates. School fundraisers and pickup orders are excluded.</p>
      {rows.length ? <div className="ccic-admin-table-wrap"><table className="ccic-admin-table">
        <thead><tr><th>Customer / council</th><th>Cart</th><th>Subtotal</th><th>Shipping</th><th>Estimated total</th><th>Last activity</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td><strong>{row.contact_name}</strong><span>{row.organization_name}</span><span><a href={`mailto:${row.email}`}>{row.email}</a></span>{row.cell_phone ? <span>{row.cell_phone}</span> : null}</td>
          <td>{row.cart_lines.map((line, index) => <span key={index}>{line.quantity} × {line.title} ({formatChristmasCardMoney(line.line_total_cents)})</span>)}</td>
          <td>{formatChristmasCardMoney(row.subtotal_cents)}</td>
          <td>{row.shipping_status === 'priced' && row.shipping_cents !== null ? formatChristmasCardMoney(row.shipping_cents) : 'Not quoted'}</td>
          <td>{formatChristmasCardMoney(row.total_cents)}</td>
          <td>{formatDate(row.last_activity_at)}</td>
        </tr>)}</tbody>
      </table></div> : <div className="ccic-admin-empty"><h2>No abandoned checkouts</h2><p>Shipping checkouts that remain unsubmitted for at least 60 minutes will appear here.</p></div>}
    </section>
  </main>
}
