import Image from 'next/image'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import { CCIC_SCHOOL_CAMPAIGNS } from '@/lib/christmas-cards/schools'
import { formatChristmasCardMoney } from '@/lib/christmas-cards/catalog'
import '../../../christmas-cards/admin-orders.css'
import './school-admin.css'

export const metadata = { title: 'CCIC School Fundraisers | Chrism' }
export const dynamic = 'force-dynamic'

type SchoolOrder = {
  id: string
  order_number: string
  school_slug: string
  school_name: string
  status_code: string
  total_cents: number
  paid_at: string | null
  school_contribution_cents: number
  created_at: string
}
type SchoolLine = {
  order_id: string
  catalog_id: string
  title: string
  quantity: number
  returned_quantity: number
  unit_price_cents: number
}

export default async function SchoolFundraisersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>
}) {
  await requireCcicOrderAdmin('/ccic/admin/school-fundraisers')
  const params = await searchParams
  const selectedSchool = typeof params.school === 'string' ? params.school : ''
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ccic_school_orders')
    .select('id,order_number,school_slug,school_name,status_code,total_cents,paid_at,school_contribution_cents,created_at')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw new Error(`Unable to load school fundraiser orders: ${error.message}`)

  const allOrders = (data ?? []) as SchoolOrder[]
  const orders = selectedSchool ? allOrders.filter((order) => order.school_slug === selectedSchool) : allOrders
  const paid = orders.filter((order) => order.status_code === 'paid')
  const paidIds = paid.map((order) => order.id)
  const { data: lineData, error: lineError } = paidIds.length
    ? await admin.from('ccic_school_order_lines')
      .select('order_id,catalog_id,title,quantity,returned_quantity,unit_price_cents').in('order_id', paidIds)
    : { data: [] as SchoolLine[], error: null }
  if (lineError) throw new Error('Unable to load school order lines')
  const lines = (lineData ?? []) as SchoolLine[]

  const boxTotals = new Map<string, { ordered: number; remaining: number; remainingValueCents: number }>()
  const collectionTotals = new Map<string, { title: string; quantity: number }>()
  for (const line of lines) {
    const remaining = Math.max(0, line.quantity - (line.returned_quantity ?? 0))
    const prev = boxTotals.get(line.order_id) ?? { ordered: 0, remaining: 0, remainingValueCents: 0 }
    boxTotals.set(line.order_id, {
      ordered: prev.ordered + line.quantity,
      remaining: prev.remaining + remaining,
      remainingValueCents: prev.remainingValueCents + remaining * line.unit_price_cents,
    })
    const previous = collectionTotals.get(line.catalog_id)
    collectionTotals.set(line.catalog_id, {
      title: line.title,
      quantity: (previous?.quantity ?? 0) + remaining,
    })
  }

  const originalPaidCents = orders.filter((order) => Boolean(order.paid_at)).reduce((sum, order) => sum + order.total_cents, 0)
  const remainingValueCents = [...boxTotals.values()].reduce((sum, row) => sum + row.remainingValueCents, 0)
  const contribution = paid.reduce((sum, order) => {
    const count = boxTotals.get(order.id)
    return sum + (count?.ordered ? Math.round(order.school_contribution_cents * count.remaining / count.ordered) : 0)
  }, 0)
  const boxes = [...boxTotals.values()].reduce((sum, row) => sum + row.remaining, 0)
  const date = (value: string) => new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium', timeZone: 'America/Toronto',
  }).format(new Date(value))

  return (
    <main className="ccic-admin-page">
      <header className="ccic-admin-header">
        <div className="ccic-admin-heading-brand">
          <Image src="/CCiC.png" alt="CCIC" width={82} height={82} className="ccic-admin-logo" priority />
          <div><h1>School Orders</h1></div>
        </div>
        <nav className="ccic-admin-header-actions">
          <Link href="/ccic/admin/orders">Council orders</Link>
          <Link href="/ccic/admin/packing-list">Packing list</Link>
          <Link href="/ccic/admin/store-control">Store control</Link>
        </nav>
      </header>

      <section className="ccic-admin-panel" style={{ marginBottom: 24 }}>
        <form className="ccic-school-admin-controls" action="/ccic/admin/school-fundraisers" method="get">
          <label htmlFor="school-filter"><strong>Schools</strong></label>{' '}
          <select id="school-filter" name="school" defaultValue={selectedSchool} style={{ maxWidth: '100%' }}>
            <option value="">All schools</option>
            {CCIC_SCHOOL_CAMPAIGNS.map((school) => (
              <option key={school.code} value={school.slug}>{school.name}</option>
            ))}
          </select>{' '}
          <button type="submit">View</button>
        </form>
      </section>

      <section className="ccic-school-admin-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
        {[
          ['Active paid parent orders', String(paid.length)],
          ['Mixed boxes to pack (net)', String(boxes)],
          ['Original paid order value', formatChristmasCardMoney(originalPaidCents)],
          ['Order value after recorded returns', formatChristmasCardMoney(remainingValueCents)],
          ['School contributions on remaining boxes', formatChristmasCardMoney(contribution)],
          ['Awaiting payment reconciliation', String(orders.filter((order) => order.status_code === 'pending_payment').length)],
        ].map(([label, value]) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e5e0da', padding: 22 }}>
            <div style={{ fontSize: 13, color: '#645e58' }}>{label}</div>
            <strong style={{ display: 'block', fontSize: 25, marginTop: 8 }}>{value}</strong>
          </div>
        ))}
        <p style={{ gridColumn: '1 / -1' }}>Order value after returns is for packing and fundraiser reporting. It does not assert that manual Square or e-transfer refunds have been completed.</p>
      </section>

      <section className="ccic-school-admin-content" style={{ background: '#fff', border: '1px solid #e5e0da', padding: 22, marginBottom: 24 }}>
        <h2>Production totals — remaining boxes</h2>
        <p><Link href={selectedSchool ? '/ccic/admin/school-fundraisers/packing-list?school=' + encodeURIComponent(selectedSchool) : '/ccic/admin/school-fundraisers/packing-list'}>Packing &amp; Labels</Link></p>
        {collectionTotals.size === 0 ? <p>No boxes to pack yet.</p> : (
          <ul>{[...collectionTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([sku, item]) => (
            <li key={sku}>{item.title}: <strong>{item.quantity} boxes</strong></li>
          ))}</ul>
        )}
      </section>

      <section className="ccic-school-admin-content" style={{ background: '#fff', border: '1px solid #e5e0da', padding: 22, overflowX: 'auto' }}>
        <h2>Individual parent orders</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead><tr>{['Order', 'School', 'Date', 'Status', 'Boxes to pack', 'Remaining order value', 'School share'].map((heading) => (
            <th key={heading} style={{ padding: 12, borderBottom: '1px solid #ddd' }}>{heading}</th>
          ))}</tr></thead>
          <tbody>{orders.map((order) => {
            const boxInfo = boxTotals.get(order.id)
            const partiallyReturned = order.status_code === 'paid' && boxInfo && boxInfo.remaining < boxInfo.ordered
            return (
              <tr key={order.id}>
                <td style={{ padding: 12, borderBottom: '1px solid #eee' }}><Link href={'/ccic/admin/school-fundraisers/' + order.id}>{order.order_number}</Link></td>
                <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>{order.school_name}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>{date(order.created_at)}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>{partiallyReturned ? 'Partially returned' : order.status_code.replaceAll('_', ' ')}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>{order.status_code === 'paid' ? boxInfo?.remaining ?? 0 : '—'}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>{order.status_code === 'paid' ? formatChristmasCardMoney(boxInfo?.remainingValueCents ?? 0) : '—'}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>{order.status_code === 'paid' && boxInfo?.ordered ? formatChristmasCardMoney(Math.round(order.school_contribution_cents * boxInfo.remaining / boxInfo.ordered)) : '—'}</td>
              </tr>
            )
          })}</tbody>
        </table>
        {orders.length === 0 && <p>No orders found for this selection.</p>}
        {allOrders.length === 1000 && <p>Showing the latest 1,000 orders. Pagination will be added before larger campaigns.</p>}
      </section>
    </main>
  )
}
