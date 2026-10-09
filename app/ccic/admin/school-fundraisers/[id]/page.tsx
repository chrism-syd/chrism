import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import { decryptOptionalValue } from '@/lib/security/pii'
import { formatChristmasCardMoney } from '@/lib/christmas-cards/catalog'
import '../../../../christmas-cards/admin-orders.css'

export const dynamic = 'force-dynamic'

export default async function SchoolOrderDetails({ params }: { params: Promise<{ id: string }> }) {
  await requireCcicOrderAdmin('/ccic/admin/school-fundraisers')
  const { id } = await params
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound()
  const admin = createAdminClient()
  const { data: order, error } = await admin.from('ccic_school_orders').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error('Unable to load school order')
  if (!order) notFound()
  const { data: items, error: itemError } = await admin.from('ccic_school_order_lines').select('id,title,quantity,line_total_cents').eq('order_id', id)
  if (itemError) throw new Error('Unable to load school order items')
  const decode = (value: string | null) => decryptOptionalValue(value) || 'Not provided'
  return <main className="ccic-admin-page"><header className="ccic-admin-header"><h1>{order.order_number}</h1><Link href="/ccic/admin/school-fundraisers">Back to Schools</Link></header><section className="ccic-admin-panel"><h2>{order.school_name}</h2><p>Status: {order.status_code}</p><p>Parent: {decode(order.parent_name)}</p><p>Email: {decode(order.email)}</p><p>Phone: {decode(order.cell_phone)}</p><h2>Student</h2><p>Name: {decode(order.student_name)}</p><p>Grade: {decode(order.grade)}</p><p>Room: {decode(order.room_number)}</p><p>Teacher: {decode(order.teacher_name)}</p><p>Total: {formatChristmasCardMoney(order.total_cents)}</p><p>School contribution: {formatChristmasCardMoney(order.school_contribution_cents)}</p><h2>Collections ordered</h2><ul>{(items ?? []).map((item) => <li key={item.id}>{item.quantity} × {item.title}: {formatChristmasCardMoney(item.line_total_cents)}</li>)}</ul></section></main>
}
