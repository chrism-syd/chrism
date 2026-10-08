import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import { CCIC_SCHOOL_CAMPAIGNS } from '@/lib/christmas-cards/schools'
import { decryptOptionalValue } from '@/lib/security/pii'
import '../../../../christmas-cards/admin-orders.css'

export const dynamic = 'force-dynamic'

export default async function SchoolPackingList({ searchParams }: { searchParams: Promise<{ school?: string }> }) {
  await requireCcicOrderAdmin('/ccic/admin/school-fundraisers')
  const { school } = await searchParams
  const selected = CCIC_SCHOOL_CAMPAIGNS.find((item) => item.slug === school)
  const admin = createAdminClient()
  const query = admin.from('ccic_school_orders').select('id,order_number,school_name,teacher_name,room_number,student_name,status_code').eq('status_code', 'paid')
  const { data, error } = await (selected ? query.eq('school_slug', selected.slug) : query)
  if (error) throw new Error('Unable to load school packing list')
  const orders = (data ?? []).map((order) => ({ ...order, teacher: decryptOptionalValue(order.teacher_name), room: decryptOptionalValue(order.room_number), student: decryptOptionalValue(order.student_name) }))
  const sorted = orders.sort((a, b) => [a.school_name, a.teacher, a.room, a.student].join('|').localeCompare([b.school_name, b.teacher, b.room, b.student].join('|'), 'en-CA', { numeric: true }))
  return <main className="ccic-admin-page"><header className="ccic-admin-header"><div><h1>School packing list</h1><p>Paid orders only</p></div><Link href="/ccic/admin/school-fundraisers">Back to Schools</Link></header><section className="ccic-admin-panel"><h2>{selected?.name || 'All schools'}</h2><p>{orders.length} orders awaiting packing review.</p><table className="ccic-admin-table"><thead><tr><th>School</th><th>Teacher</th><th>Room</th><th>Student</th><th>Order</th></tr></thead><tbody>{sorted.map((order) => <tr key={order.id}><td>{order.school_name}</td><td>{order.teacher}</td><td>{order.room}</td><td>{order.student}</td><td>{order.order_number}</td></tr>)}</tbody></table></section></main>
}
