import Image from 'next/image'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import { CCIC_SCHOOL_CAMPAIGNS } from '@/lib/christmas-cards/schools'
import { formatChristmasCardMoney } from '@/lib/christmas-cards/catalog'
import { ccicSchoolMarketCollectionName, loadCcicSchoolMarketSales, summarizeCcicSchoolMarketSales } from '@/lib/christmas-cards/school-market-sales'
import '../../../christmas-cards/admin-orders.css'
import './school-admin.css'

export const metadata = { title: 'CCIC School Fundraisers | Chrism' }
export const dynamic = 'force-dynamic'

type SchoolOrder = {
  id: string
  order_number: string
  school_slug: string
  school_name: string
  square_environment: string
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
  // Apply the school filter in the database before the limit; never mix
  // another school's orders into a school-specific report or truncate them out.
  const baseQuery = admin.from('ccic_school_orders')
    .select('id,order_number,school_slug,school_name,square_environment,status_code,total_cents,paid_at,school_contribution_cents,created_at')
  const selectedQuery = selectedSchool ? baseQuery.eq('school_slug', selectedSchool) : baseQuery
  const { data, error } = await selectedQuery
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw new Error(`Unable to load school fundraiser orders: ${error.message}`)

  const allOrders = (data ?? []) as SchoolOrder[]
  const orders = allOrders
  // Sandbox orders remain visible in audit history, but never count toward
  // physical packing, school remittance or real-money campaign totals.
  const paid = orders.filter((order) => order.status_code === 'paid' && order.square_environment === 'production')
  const paidIds = paid.map((order) => order.id)
  const { data: lineData, error: lineError } = paidIds.length
    ? await admin.from('ccic_school_order_lines')
      .select('order_id,catalog_id,title,quantity,returned_quantity,unit_price_cents').in('order_id', paidIds)
    : { data: [] as SchoolLine[], error: null }
  if (lineError) throw new Error('Unable to load school order lines')
  const lines = (lineData ?? []) as SchoolLine[]
  // These in-person sales are financial records only, never school orders to pack.
  const marketSales = await loadCcicSchoolMarketSales(selectedSchool)
  const marketTotals = summarizeCcicSchoolMarketSales(marketSales)

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

  const remainingValueCents = [...boxTotals.values()].reduce((sum, row) => sum + row.remainingValueCents, 0)
  const contribution = paid.reduce((sum, order) => {
    const count = boxTotals.get(order.id)
    return sum + (count?.ordered ? Math.round(order.school_contribution_cents * count.remaining / count.ordered) : 0)
  }, 0)
  const boxes = [...boxTotals.values()].reduce((sum, row) => sum + row.remaining, 0)
  const totalBoxes = boxes + marketTotals.boxes
  const totalEarningsCents = contribution + marketTotals.schoolEarningsCents
  const totalSalesCents = marketTotals.salesCents === null ? null : remainingValueCents + marketTotals.salesCents
  const salesMetrics = [
    {
      label: 'Total sales',
      value: totalSalesCents === null ? 'Incomplete' : formatChristmasCardMoney(totalSalesCents),
      detail: 'Online + in-person · after recorded returns',
    },
    {
      label: 'Total boxes sold',
      value: String(totalBoxes),
      detail: 'Online + in-person · after recorded returns',
    },
    {
      label: 'Total school earnings',
      value: formatChristmasCardMoney(totalEarningsCents),
      detail: 'All sales channels',
    },
  ]
  const fulfilmentMetrics = [
    {
      label: 'Paid online orders',
      value: String(paid.length),
      detail: 'Website purchases',
    },
    {
      label: 'Online boxes to pack',
      value: String(boxes),
      detail: 'For classroom distribution',
    },
    {
      label: 'In-person boxes sold',
      value: String(marketTotals.boxes),
      detail: 'Already handed to customers',
    },
  ]
  const date = (value: string) => new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium', timeZone: 'America/Toronto',
  }).format(new Date(value))

  return (
    <main className="ccic-admin-page">
      <header className="ccic-admin-header">
        <div className="ccic-admin-heading-brand">
          <Image src="/CCiC.png" alt="CCIC" width={82} height={82} className="ccic-admin-logo" priority />
          <div><h1>School Fundraiser Sales</h1></div>
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

      <section className="ccic-school-admin-content ccic-school-sales-summary" aria-label="School sales summary">
        <div className="ccic-school-sales-summary-heading">
          <h2>Sales overview</h2>
          <p>Combined online and in-person sales, with fulfilment kept separate.</p>
        </div>
        <div className="ccic-school-sales-metrics" aria-label="Combined sales totals">
          {salesMetrics.map((metric) => (
            <div className="ccic-school-sales-metric" key={metric.label}>
              <span className="ccic-school-sales-metric-label">{metric.label}</span>
              <strong className="ccic-school-sales-metric-value">{metric.value}</strong>
              <span className="ccic-school-sales-metric-detail">{metric.detail}</span>
            </div>
          ))}
        </div>
        <div className="ccic-school-sales-metrics ccic-school-sales-metrics--breakdown" aria-label="Online and in-person breakdown">
          {fulfilmentMetrics.map((metric) => (
            <div className="ccic-school-sales-metric ccic-school-sales-metric--secondary" key={metric.label}>
              <span className="ccic-school-sales-metric-label">{metric.label}</span>
              <strong className="ccic-school-sales-metric-value">{metric.value}</strong>
              <span className="ccic-school-sales-metric-detail">{metric.detail}</span>
            </div>
          ))}
        </div>
        <p className="ccic-school-sales-summary-note">
          Figures are based on paid online purchases after recorded returns and logged in-person sales.
          They are not a reconciliation of Square deposits or refunds.
          In-person sales never appear in packing lists, labels or classroom distribution.
        </p>
      </section>

      {marketSales.length > 0 ? (
        <section className="ccic-school-admin-content" style={{ background: '#fff', border: '1px solid #e5e0da', padding: 22, marginBottom: 24, overflowX: 'auto' }}>
          <h2>In-person sales — already fulfilled</h2>
          <p>These sales count toward school earnings but not packing, labels or classroom distribution. Online order totals above remain separate.</p>
          <p><strong>{marketTotals.boxes} boxes sold</strong> · {marketTotals.salesCents === null ? 'Some selling prices not recorded' : formatChristmasCardMoney(marketTotals.salesCents) + ' in sales'} · <strong>{formatChristmasCardMoney(marketTotals.schoolEarningsCents)} in school earnings</strong></p>
          <table className="ccic-admin-table" style={{ width: '100%' }}>
            <thead><tr><th>School</th><th>Date</th><th>Event</th><th>Collection</th><th>Boxes</th><th>Sales</th><th>School earnings</th></tr></thead>
            <tbody>{marketSales.map((sale) => <tr key={sale.school_slug + ':' + sale.event_key + ':' + sale.catalog_id}>
              <td>{CCIC_SCHOOL_CAMPAIGNS.find((school) => school.slug === sale.school_slug)?.name ?? sale.school_slug}</td>
              <td>{sale.sale_date}</td>
              <td>{sale.event_name}</td>
              <td>{ccicSchoolMarketCollectionName(sale.catalog_id)}</td>
              <td>{sale.boxes_sold}</td>
              <td>{sale.unit_price_cents === null ? 'Not recorded' : formatChristmasCardMoney(sale.boxes_sold * sale.unit_price_cents)}</td>
              <td>{formatChristmasCardMoney(sale.boxes_sold * sale.school_earnings_per_box_cents)}</td>
            </tr>)}</tbody>
          </table>
        </section>
      ) : null}

      <section className="ccic-school-admin-content" style={{ background: '#fff', border: '1px solid #e5e0da', padding: 22, marginBottom: 24 }}>
        <h2>Online orders — remaining boxes to pack</h2>
        <p><Link href={selectedSchool ? '/ccic/admin/school-fundraisers/packing-list?school=' + encodeURIComponent(selectedSchool) : '/ccic/admin/school-fundraisers/packing-list'}>Packing &amp; Labels</Link></p>
        {collectionTotals.size === 0 ? <p>No boxes to pack yet.</p> : (
          <ul>{[...collectionTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([sku, item]) => (
            <li key={sku}>{item.title}: <strong>{item.quantity} boxes</strong></li>
          ))}</ul>
        )}
      </section>

      <section className="ccic-school-admin-content" style={{ background: '#fff', border: '1px solid #e5e0da', padding: 22, overflowX: 'auto' }}>
        <h2>Online school orders</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead><tr>{['Order', 'School', 'Date', 'Status', 'Boxes to pack', 'Remaining order value', 'School share'].map((heading) => (
            <th key={heading} style={{ padding: 12, borderBottom: '1px solid #ddd' }}>{heading}</th>
          ))}</tr></thead>
          <tbody>{orders.map((order) => {
            const boxInfo = boxTotals.get(order.id)
            const eligibleForPacking = order.status_code === 'paid' && order.square_environment === 'production'
            const partiallyReturned = eligibleForPacking && boxInfo && boxInfo.remaining < boxInfo.ordered
            return (
              <tr key={order.id}>
                <td style={{ padding: 12, borderBottom: '1px solid #eee' }}><Link href={'/ccic/admin/school-fundraisers/' + order.id}>{order.order_number}</Link></td>
                <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>{order.school_name}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>{date(order.created_at)}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>{order.square_environment === 'sandbox' ? `Sandbox test (${order.status_code.replaceAll('_', ' ')})` : partiallyReturned ? 'Partially returned' : order.status_code.replaceAll('_', ' ')}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>{eligibleForPacking ? boxInfo?.remaining ?? 0 : '—'}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>{order.status_code === 'paid' ? formatChristmasCardMoney(boxInfo?.remainingValueCents ?? 0) : '—'}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #eee' }}>{eligibleForPacking && boxInfo?.ordered ? formatChristmasCardMoney(Math.round(order.school_contribution_cents * boxInfo.remaining / boxInfo.ordered)) : '—'}</td>
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
