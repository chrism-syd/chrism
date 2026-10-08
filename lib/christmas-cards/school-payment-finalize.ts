import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptOptionalValue } from '@/lib/security/pii'
import { sendBrevoTransactionalEmail } from '@/lib/email/brevo'

type SquarePayment = {
  id?: string
  status?: string
  reference_id?: string
  location_id?: string
  amount_money?: { amount?: number; currency?: string }
  receipt_url?: string
  created_at?: string
}

export async function finalizeCcicSchoolPayment(orderId: string, payment: SquarePayment) {
  const admin = createAdminClient()
  const { data: order, error: lookupError } = await admin.from('ccic_school_orders')
    .select('id,order_number,status_code,total_cents,square_location_id,square_payment_id,square_environment')
    .eq('id', orderId).single()
  if (lookupError || !order) throw new Error('School order could not be located.')
  if (payment.status !== 'COMPLETED' || !payment.id || payment.reference_id !== orderId ||
      payment.location_id !== order.square_location_id ||
      payment.amount_money?.amount !== order.total_cents ||
      payment.amount_money?.currency !== 'CAD' ||
      order.square_environment !== 'sandbox' ||
      (order.square_payment_id && order.square_payment_id !== payment.id)) {
    throw new Error('Square payment does not match the stored school order.')
  }

  const { error } = await admin.rpc('ccic_finalize_school_payment', {
    p_order_id: orderId,
    p_payment_id: payment.id,
    p_payment_status: payment.status,
    p_receipt_url: payment.receipt_url || null,
    p_paid_at: payment.created_at || new Date().toISOString(),
  })
  if (error) throw new Error(`Unable to finalize school payment: ${error.message}`)
  return { orderNumber: order.order_number, totalCents: order.total_cents }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] || char)
}

export async function sendCcicSchoolOrderConfirmation(orderId: string) {
  const admin = createAdminClient()
  const { data: claimed, error: claimError } = await admin.from('ccic_school_orders')
    .update({ confirmation_email_claimed_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status_code', 'paid')
    .not('inventory_committed_at', 'is', null)
    .is('confirmation_email_sent_at', null)
    .is('confirmation_email_claimed_at', null)
    .select('id,order_number,school_name,email,parent_name,total_cents,school_contribution_cents')
    .maybeSingle()
  if (claimError) throw new Error(`Unable to claim school confirmation: ${claimError.message}`)
  if (!claimed) return

  try {
    const { data: lines, error: linesError } = await admin.from('ccic_school_order_lines')
      .select('title,quantity,line_total_cents').eq('order_id', orderId).order('sort_order')
    if (linesError) throw new Error(linesError.message)
    const email = decryptOptionalValue(claimed.email)
    const name = decryptOptionalValue(claimed.parent_name) || 'Customer'
    if (!email) throw new Error('School order email is missing.')
    const money = (cents: number) => `$${(cents / 100).toFixed(2)} CAD`
    const lineText = (lines || []).map((line) => `${line.quantity} × ${line.title}: ${money(line.line_total_cents)}`).join('\n')
    const text = `Thank you, ${name}.\n\nYour CCIC school fundraiser order ${claimed.order_number} has been paid.\n\n${lineText}\n\nTotal: ${money(claimed.total_cents)}\nSupports ${claimed.school_name}: ${money(claimed.school_contribution_cents)}\n\nYour cards will be delivered to ${claimed.school_name} for distribution.\n\nYour card statement will show the merchant as sq *Knight of Columbus Council #7689.\n\nThis is a sandbox test order; no real payment was taken.`
    await sendBrevoTransactionalEmail({
      to: [{ email, name }],
      bcc: [
        { email: 'orders@ccic.supplies', name: 'CCIC Orders' },
        { email: 'ccic@kofc7689.org', name: 'CCIC' },
      ],
      subject: `CCIC school order confirmation ${claimed.order_number}`,
      textContent: text,
      htmlContent: `<p>Thank you, ${escapeHtml(name)}.</p><p>Your CCIC school fundraiser order <strong>${escapeHtml(claimed.order_number)}</strong> has been paid.</p><ul>${(lines || []).map((line) => `<li>${line.quantity} × ${escapeHtml(line.title)}: ${money(line.line_total_cents)}</li>`).join('')}</ul><p><strong>Total: ${money(claimed.total_cents)}</strong><br>Supports ${escapeHtml(claimed.school_name)}: ${money(claimed.school_contribution_cents)}</p><p>Your cards will be delivered to ${escapeHtml(claimed.school_name)} for distribution.</p><p>Your card statement will show the merchant as <strong>sq *Knight of Columbus Council #7689</strong>.</p><p><em>Sandbox test order. No real payment was taken.</em></p>`,
    })
    const { error: sentError } = await admin.from('ccic_school_orders')
      .update({ confirmation_email_sent_at: new Date().toISOString(), confirmation_email_error: null })
      .eq('id', orderId)
    if (sentError) throw new Error(sentError.message)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown email failure'
    await admin.from('ccic_school_orders')
      .update({ confirmation_email_error: message.slice(0, 400), confirmation_email_claimed_at: null })
      .eq('id', orderId)
    console.error('CCIC school confirmation email failed', { orderId, error: message })
  }
}
