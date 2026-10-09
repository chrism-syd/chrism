import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import { CCIC_SCHOOL_CAMPAIGNS } from '@/lib/christmas-cards/schools'
import { decryptOptionalValue } from '@/lib/security/pii'
import '../../../../christmas-cards/admin-orders.css'
import './print.css'

export const dynamic = 'force-dynamic'

export default async function SchoolPackingList({ searchParams }: { searchParams: Promise<{ school?: string; print?: string }> }) {
  await requireCcicOrderAdmin('/ccic/admin/school-fundraisers')
  const { school, print } = await searchParams
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
  const labels = sorted.flatMap((order) => {
    const items = (lines ?? []).filter((line) => line.order_id === order.id)
    const totalBoxes = items.reduce((sum, line) => sum + line.quantity, 0)
    let boxNumber = 0
    return items.flatMap((line) => Array.from({ length: line.quantity }, () => ({ ...order, collection: line.title, boxNumber: ++boxNumber, totalBoxes })))
  })
  if (print === 'labels') return <main className="ccic-label-print-page"><style>{'@page { size: 4in 6in; margin: 0; } @media print { html,body { margin:0!important; padding:0!important; } .ccic-label-print-controls { display:none!important; } }'}</style><div className="ccic-label-print-controls"><Link href={'/ccic/admin/school-fundraisers/packing-list?school=' + encodeURIComponent(selected.slug)}>Back to packing list</Link><p>Avery 72782 · 4 × 6 inch sheets · 5 labels per sheet. Print at 100% scale with margins set to none.</p><button type="button" onClick={undefined}>Use your browser Print command</button></div>{Array.from({ length: Math.ceil(labels.length / 5) }, (_, sheet) => <div className="ccic-avery-sheet" key={sheet}>{labels.slice(sheet * 5, sheet * 5 + 5).map((label, i) => <div className="ccic-avery-label" key={i}><strong>{label.student}</strong><span>Grade {label.grade} · Room {label.room}</span><span>{label.teacher}</span>{label.totalBoxes > 1 && <b>BOX {label.boxNumber} of {label.totalBoxes}</b>}</div>)}</div>)}</main>
  const totals = new Map<string, number>()
  for (const line of lines ?? []) totals.set(line.title, (totals.get(line.title) ?? 0) + line.quantity)
  const boxesByOrder = new Map<string, number>()
  for (const line of lines ?? []) boxesByOrder.set(line.order_id, (boxesByOrder.get(line.order_id) ?? 0) + line.quantity)
  const classrooms = new Map<string, { grade: string; room: string; teacher: string; students: typeof sorted; boxes: number }>()
  for (const order of sorted) {
    const key = JSON.stringify([order.grade, order.room, order.teacher])
    const classroom = classrooms.get(key) ?? { grade: order.grade, room: order.room, teacher: order.teacher, students: [] as typeof sorted, boxes: 0 }
    classroom.students.push(order)
    classroom.boxes += boxesByOrder.get(order.id) ?? 0
    classrooms.set(key, classroom)
  }
  const groups = [...classrooms.values()]
  return <main className="ccic-admin-page ccic-school-distribution">
    <header className="ccic-admin-header ccic-screen-only"><div><h1>Packing &amp; Labels</h1><p>Paid school orders</p></div><nav className="ccic-admin-header-actions"><Link href="/ccic/admin/school-fundraisers">Back to School Orders</Link></nav></header>
    <div className="ccic-screen-only ccic-school-distribution-controls"><form method="get"><label htmlFor="school">School </label><select id="school" name="school" defaultValue={selected.slug}>{CCIC_SCHOOL_CAMPAIGNS.map((campaign) => <option key={campaign.slug} value={campaign.slug}>{campaign.name}</option>)}</select> <button type="submit">View</button></form><p>Print the summary and classroom sheets using your browser Print command.</p><p><Link href={'/ccic/admin/school-fundraisers/packing-list?school=' + encodeURIComponent(selected.slug) + '&print=labels'}>Print Avery 72782 box labels (5 per sheet)</Link></p></div>
    <section className="ccic-school-distribution-page ccic-school-summary">
      <h1>{selected.name}</h1><h2>School distribution summary</h2>
      <p>{sorted.length} paid orders · {labels.length} boxes · {groups.length} classrooms</p>
      <table className="ccic-admin-table"><thead><tr><th>Grade</th><th>Room</th><th>Teacher</th><th>Boxes</th></tr></thead><tbody>{groups.map((group) => <tr key={JSON.stringify([group.grade, group.room, group.teacher])}><td>{group.grade}</td><td>{group.room}</td><td>{group.teacher}</td><td>{group.boxes}</td></tr>)}</tbody><tfoot><tr><th colSpan={3}>Total</th><th>{labels.length}</th></tr></tfoot></table>
      <h3>Production totals</h3><ul>{[...totals.entries()].map(([title, count]) => <li key={title}>{title}: {count} boxes</li>)}</ul>
    </section>
    {groups.map((group) => <section className="ccic-school-distribution-page ccic-school-classroom" key={JSON.stringify([group.grade, group.room, group.teacher])}>
      <h2>Grade {group.grade} | Room {group.room} | {group.teacher}</h2><p>{group.boxes} boxes · {group.students.length} orders</p>
      <table className="ccic-admin-table"><thead><tr><th>Packed</th><th>Student</th><th>Boxes</th></tr></thead><tbody>{group.students.map((order) => <tr key={order.id}><td>☐</td><td>{order.student}</td><td>{boxesByOrder.get(order.id) ?? 0}</td></tr>)}</tbody><tfoot><tr><th colSpan={2}>Classroom total</th><th>{group.boxes}</th></tr></tfoot></table>
    </section>)}
  </main>
}
