import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import { CCIC_SCHOOL_CAMPAIGNS } from '@/lib/christmas-cards/schools'
import { decryptOptionalValue } from '@/lib/security/pii'
import '../../../../christmas-cards/admin-orders.css'
import './print.css'

export const dynamic = 'force-dynamic'

export default async function SchoolPackingList({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
  await requireCcicOrderAdmin('/ccic/admin/school-fundraisers')
  const { school } = await searchParams
  const selected = CCIC_SCHOOL_CAMPAIGNS.find((item) => item.slug === school)
  if (!selected) return <main className="ccic-admin-page"><h1>Packing &amp; Labels</h1><p>Select a school to view its packing list.</p><ul>{CCIC_SCHOOL_CAMPAIGNS.map((item) => <li key={item.slug}><Link href={'/ccic/admin/school-fundraisers/packing-list?school=' + encodeURIComponent(item.slug)}>{item.name}</Link></li>)}</ul></main>
  const admin = createAdminClient()
  const query = admin.from('ccic_school_orders').select('id,order_number,school_name,teacher_name,room_number,student_name,grade,status_code').eq('status_code', 'paid')
  const { data, error } = await (selected ? query.eq('school_slug', selected.slug) : query)
  if (error) throw new Error('Unable to load school packing list')
  const orders = (data ?? []).map((order) => ({ ...order, teacher: decryptOptionalValue(order.teacher_name), room: decryptOptionalValue(order.room_number), student: decryptOptionalValue(order.student_name), grade: decryptOptionalValue(order.grade) }))
  const sorted = orders.sort((a, b) => [a.grade, a.room, a.student].join('|').localeCompare([b.grade, b.room, b.student].join('|'), 'en-CA', { numeric: true }))
  const ids = sorted.map((order) => order.id)
  const { data: lines, error: linesError } = ids.length ? await admin.from('ccic_school_order_lines').select('order_id,title,quantity').in('order_id', ids) : { data: [], error: null }
  if (linesError) throw new Error('Unable to load school packing items')
  const labels = sorted.flatMap((order) => (lines ?? []).filter((line) => line.order_id === order.id).flatMap((line) => Array.from({ length: line.quantity }, () => ({ ...order, collection: line.title }))))
  const totals = new Map<string, number>()
  for (const line of lines ?? []) totals.set(line.title, (totals.get(line.title) ?? 0) + line.quantity)
  return <main className="ccic-admin-page"><header className="ccic-admin-header"><div><h1>School packing list</h1><p>Paid orders only</p></div><div className="ccic-admin-header-actions"><Link href="/ccic/admin/school-fundraisers">Back to Schools</Link></div></header><section className="ccic-admin-panel"><h2>{selected?.name || 'All schools'}</h2><p>{orders.length} paid orders · {[...totals.values()].reduce((sum, count) => sum + count, 0)} boxes</p><h3>Production totals</h3><ul>{[...totals.entries()].map(([title, count]) => <li key={title}>{title}: {count} boxes</li>)}</ul><p>Use your browser Print command to print this packing list.</p><form method="get"><label htmlFor="school">School </label><select id="school" name="school" defaultValue={selected?.slug || ''}><option value="">All schools</option>{CCIC_SCHOOL_CAMPAIGNS.map((campaign) => <option key={campaign.slug} value={campaign.slug}>{campaign.name}</option>)}</select><button type="submit">View</button></form><table className="ccic-admin-table"><thead><tr><th>Packed</th><th>Grade</th><th>School</th><th>Teacher</th><th>Room</th><th>Student</th><th>Order</th><th>Collections</th></tr></thead><tbody>{sorted.map((order) => <tr key={order.id}><td>☐</td><td>{order.grade}</td><td>{order.school_name}</td><td>{order.teacher}</td><td>{order.room}</td><td>{order.student}</td><td><Link href={'/ccic/admin/school-fundraisers/' + order.id}>{order.order_number}</Link></td><td>{(lines ?? []).filter((line) => line.order_id === order.id).map((line) => <div key={line.title}>{line.quantity} × {line.title}</div>)}</td></tr>)}</tbody></table><h2>Box labels</h2><p>One label per physical box, in grade/room/student order.</p><div className="ccic-school-label-grid">{labels.map((label, index) => <div key={index} className="ccic-school-label"><strong>{label.student}</strong><span>{label.school_name}</span><span>Grade {label.grade || ''} · Room {label.room}</span><span>{label.teacher}</span><strong>{label.collection}</strong></div>)}</div></section></main>
}
