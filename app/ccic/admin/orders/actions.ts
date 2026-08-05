'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireCcicOrderAdmin } from '@/lib/christmas-cards/admin'
import { isCcicOrderStatus, type CcicOrderStatus } from '@/lib/christmas-cards/admin-order-status'

function formText(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function statusTimestampField(status: CcicOrderStatus) {
  if (status === 'paid') return 'paid_at'
  if (status === 'packed') return 'packed_at'
  if (status === 'shipped') return 'shipped_at'
  return null
}

export async function updateCcicOrderStatus(formData: FormData) {
  const orderId = formText(formData, 'order_id')
  const status = formText(formData, 'status')

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
    redirect('/ccic/admin/orders?error=invalid-order')
  }

  await requireCcicOrderAdmin(`/ccic/admin/orders/${orderId}`)

  if (!isCcicOrderStatus(status)) {
    redirect(`/ccic/admin/orders/${orderId}?error=invalid-status`)
  }

  const now = new Date().toISOString()
  const updates: Record<string, string> = {
    status_code: status,
    updated_at: now,
  }
  const timestampField = statusTimestampField(status)
  if (timestampField) updates[timestampField] = now

  const admin = createAdminClient()
  const { error } = await admin
    .from('ccic_orders')
    .update(updates)
    .eq('id', orderId)

  if (error) {
    console.error('CCIC order status update failed', error)
    redirect(`/ccic/admin/orders/${orderId}?error=status-update`)
  }

  revalidatePath('/ccic/admin/orders')
  revalidatePath(`/ccic/admin/orders/${orderId}`)
  revalidatePath('/ccic/admin/packing-list')
  redirect(`/ccic/admin/orders/${orderId}?updated=1`)
}
