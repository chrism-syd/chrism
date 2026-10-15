'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'

const ROOT = '/ccic/admin/school-fundraisers'
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const read = (form: FormData, name: string) => {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

export async function returnCcicSchoolParentOrderItems(formData: FormData) {
  const orderId = read(formData, 'order_id')
  if (!isUuid(orderId)) redirect(`${ROOT}?error=invalid-order`)

  // Admin authentication is mandatory on the server action, not just the page.
  const session = await requireCcicOrderAdmin(`${ROOT}/${orderId}`)
  const orderUrl = `${ROOT}/${orderId}`
  const requestKey = read(formData, 'request_key')
  const reason = read(formData, 'reason')
  const physicalStockConfirmed = read(formData, 'confirm_inventory') === 'yes'
  const manualRefundAcknowledged = read(formData, 'confirm_refund') === 'yes'

  if (!isUuid(requestKey) || reason.length < 5 || reason.length > 500 ||
      !physicalStockConfirmed || !manualRefundAcknowledged) {
    redirect(`${orderUrl}?error=return-confirmation`)
  }

  // A browser retry after a successful return must report "already processed"
  // before comparing the previously requested quantities to today's remainder.
  // The database's unique request key and row lock remain authoritative for
  // truly concurrent submissions.
  const admin = createAdminClient()
  const { data: previousReturn, error: previousReturnError } = await admin
    .from('ccic_school_order_returns')
    .select('order_id')
    .eq('request_key', requestKey)
    .maybeSingle()
  if (previousReturnError) {
    console.error('CCIC return retry lookup failed', { orderId, code: previousReturnError.code })
    redirect(`${orderUrl}?error=return-failed`)
  }
  if (previousReturn) {
    if (previousReturn.order_id !== orderId) redirect(`${orderUrl}?error=return-failed`)
    redirect(`${orderUrl}?returned=already`)
  }

  // Server fetch determines the valid order-line IDs and original quantities.
  // The database enforces unreturned quantities inside a locked transaction.
  const { data: orderLines, error: lineError } = await admin
    .from('ccic_school_order_lines')
    .select('id,quantity,returned_quantity')
    .eq('order_id', orderId)
  if (lineError || !orderLines?.length) {
    redirect(`${orderUrl}?error=return-failed`)
  }

  const items: Array<{ line_id: string; quantity: number }> = []
  for (const line of orderLines) {
    const raw = read(formData, `return_${line.id}`) || '0'
    if (!/^\d+$/.test(raw)) redirect(`${orderUrl}?error=invalid-quantity`)
    const quantity = Number(raw)
    const remaining = line.quantity - (line.returned_quantity ?? 0)
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > remaining) {
      redirect(`${orderUrl}?error=invalid-quantity`)
    }
    if (quantity > 0) items.push({ line_id: line.id, quantity })
  }
  if (!items.length) redirect(`${orderUrl}?error=no-returns`)

  // Atomic, idempotent RPC; does NOT call Square, refund a payment, or alter
  // physical stock_on_hand. Only the chosen parent's selected line quantities.
  const { data, error } = await admin.rpc('ccic_return_school_order_items', {
    p_order_id: orderId,
    p_request_key: requestKey,
    p_items: items,
    p_reason: reason,
    p_processed_by: session.email,
  })
  if (error) {
    console.error('CCIC parent-order return failed', {
      orderId, code: error.code, message: error.message,
    })
    redirect(`${orderUrl}?error=return-failed`)
  }

  revalidatePath('/ccic')
  revalidatePath(ROOT)
  revalidatePath(orderUrl)
  revalidatePath(`${ROOT}/packing-list`)
  revalidatePath('/ccic/admin/store-control')
  revalidatePath('/ccic/admin/orders')
  const result = data as { already_processed?: boolean; fully_returned?: boolean } | null
  redirect(`${orderUrl}?returned=${result?.already_processed ? 'already' : result?.fully_returned ? 'full' : 'partial'}`)
}
