import Image from 'next/image'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import { CCIC_SCHOOL_CAMPAIGNS } from '@/lib/christmas-cards/schools'
import { formatChristmasCardMoney } from '@/lib/christmas-cards/catalog'
import '../../../christmas-cards/admin-orders.css'
import '../../../christmas-cards/school-admin.css'

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
    <main className="ccic-admin-page ccic-school-admin">
      <header className="ccic-admin-header ccic-school-header">
        <div className="ccic-admin-heading-brand">
          <Image src="/CCiC.png" alt="CCIC" width={72} height={72} />
          <div>
            <p className="ccic-school-eyebrow">Celebrate Christ in Christmas</p>
            <h1>School Orders</h1>
            <p className="ccic-school-subtitle">Fundraiser orders, packing and parent returns in one place.</p>
          </div>
        </div>
        <nav className="ccic-admin-header-actions" aria-label="CCIC admin navigation">
          <Link href="/ccic/admin/orders">Council orders</Link>
          <Link href="/ccic/admin/packing-list">Council packing</Link>
          <Link href="/ccic/admin/store-control">Store control</Link>
        </nav>
      </header>

      <div className="ccic-school-shell">
        <section className="ccic-school-panel ccic-school-toolbar" aria-label="Choose school">
          <form action="/ccic/admin/school-fundraisers" method="get">
            <div className="ccic-school-field">
              <label htmlFor="school-filter">School</label>
              <select id="school-filter" name="school" defaultValue={selectedSchool}>
                <option value="">All schools</option>
                {CCIC_SCHOOL_CAMPAIGNS.map((school) => (
                  <option key={school.code} value={school.slug}>{school.name}</option>
                ))}
              </select>
            </div>
            <button type="submit">View orders</button>
            <Link className="ccic-school-text-link" href={selectedSchool
              ? '/ccic/admin/school-fundraisers/packing-list?school=' + encodeURIComponent(selectedSchool)
              : '/ccic/admin/school-fundraisers/packing-list'}>
              Packing &amp; labels →
            </Link>
          </form>
        </section>

        <section aria-label="School order overview">
          <div className="ccic-school-panel-header">
            <div>
              <h2>At a glance</h2>
              <p>Live totals for {selectedSchool ? CCIC_SCHOOL_CAMPAIGNS.find((school) => school.slug === selectedSchool)?.name ?? 'selected school' : 'all schools'}.</p>
            </div>
          </div>
          <div className="ccic-school-overview">
            <div className="ccic-school-metric is-primary"><span>Active paid parent orders</span><strong>{paid.length}</strong></div>
            <div className="ccic-school-metric"><span>Mixed boxes remaining to pack</span><strong>{boxes}</strong></div>
            <div className="ccic-school-metric is-attention">
              <span>Awaiting payment reconciliation</span>
              <strong>{orders.filter((order) => order.status_code === 'pending_payment').length}</strong>
            </div>
          </div>
        </section>

        <details className="ccic-school-report">
          <summary>Fundraiser financial summary</summary>
          <div className="ccic-school-report-body">
            <div className="ccic-school-finance-grid">
              <div className="ccic-school-metric"><span>Original paid order value</span><strong>{formatChristmasCardMoney(originalPaidCents)}</strong></div>
              <div className="ccic-school-metric"><span>Value of remaining boxes</span><strong>{formatChristmasCardMoney(remainingValueCents)}</strong></div>
              <div className="ccic-school-metric"><span>School contributions on remaining boxes</span><strong>{formatChristmasCardMoney(contribution)}</strong></div>
            </div>
            <p className="ccic-school-report-note">Values after returns support packing and fundraiser reporting. They do not confirm that manual Square or e-transfer refunds have been completed.</p>
          </div>
        </details>

        <section className="ccic-school-panel">
          <div className="ccic-school-panel-header">
            <div><h2>Production totals</h2><p>Remaining mixed boxes to prepare, grouped by collection.</p></div>
            <Link className="ccic-school-text-link" href={selectedSchool
              ? '/ccic/admin/school-fundraisers/packing-list?school=' + encodeURIComponent(selectedSchool)
              : '/ccic/admin/school-fundraisers/packing-list'}>
              Open packing &amp; labels →
            </Link>
          </div>
          {collectionTotals.size === 0 ? <p className="ccic-school-helper">No paid boxes to pack yet.</p> : (
            <ul className="ccic-school-production-list">
              {[...collectionTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([sku, item]) => (
                <li key={sku}><span>{item.title}</span><strong>{item.quantity} <small>boxes</small></strong></li>
              ))}
            </ul>
          )}
        </section>

        <section className="ccic-school-panel">
          <div className="ccic-school-panel-header">
            <div><h2>Parent orders</h2><p>{orders.length} order{orders.length === 1 ? '' : 's'} in this view. Select an order for student details or returns.</p></div>
          </div>
          <div className="ccic-admin-table-wrap">
            <table className="ccic-admin-table" aria-label="School parent orders">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">School</th>
                  <th scope="col">Date</th>
                  <th scope="col">Status</th>
                  <th scope="col">Boxes to pack</th>
                  <th scope="col">Remaining value</th>
                  <th scope="col">School share</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const boxInfo = boxTotals.get(order.id)
                  const partiallyReturned = order.status_code === 'paid' && boxInfo && boxInfo.remaining < boxInfo.ordered
                  const statusClass = partiallyReturned ? 'is-partial' : order.status_code === 'paid' ? 'is-paid' : order.status_code === 'cancelled' ? 'is-cancelled' : order.status_code === 'pending_payment' ? 'is-pending' : ''
                  const statusLabel = partiallyReturned ? 'Partially returned' : order.status_code.replaceAll('_', ' ')
                  return (
                    <tr key={order.id}>
                      <td><Link href={'/ccic/admin/school-fundraisers/' + order.id}>{order.order_number}</Link></td>
                      <td>{order.school_name}</td>
                      <td>{date(order.created_at)}</td>
                      <td><span className={'ccic-school-status ' + statusClass}>{statusLabel}</span></td>
                      <td data-numeric="true">{order.status_code === 'paid' ? boxInfo?.remaining ?? 0 : '—'}</td>
                      <td data-numeric="true">{order.status_code === 'paid' ? formatChristmasCardMoney(boxInfo?.remainingValueCents ?? 0) : '—'}</td>
                      <td data-numeric="true">{order.status_code === 'paid' && boxInfo?.ordered ? formatChristmasCardMoney(Math.round(order.school_contribution_cents * boxInfo.remaining / boxInfo.ordered)) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {orders.length === 0 && <p className="ccic-school-empty">No orders found for this school.</p>}
          </div>
          {allOrders.length === 1000 && <p className="ccic-school-helper">Showing the latest 1,000 orders. Pagination will be added before larger campaigns.</p>}
        </section>
      </div>
    </main>
  )
}
