import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
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
  return <main className="ccic-admin-page"><header className="ccic-admin-header"><h1>{order.order_number}</h1><Link href="/ccic/admin/school-fundraisers">Back to Schools</Link></header><section className="ccic-admin-panel"><h2>{order.school_name}</h2><p>Status: {order.status_code}</p></section></main>
}
