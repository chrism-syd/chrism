import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptOptionalValue } from '@/lib/security/pii'
import { sendBrevoTransactionalEmail } from '@/lib/email/brevo'
import { getCcicSchoolCampaignByCode, formatCcicSchoolCampaignDate } from '@/lib/christmas-cards/schools'

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
    .select('id,order_number,school_name,school_code,email,parent_name,total_cents,school_contribution_cents')
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
    const money = (cents: number) => `$${(cents / 100).toFixed(2)}`
    const school = getCcicSchoolCampaignByCode(claimed.school_code)
    const deliveryDate = formatCcicSchoolCampaignDate(school?.deliveryBy)
    const deliveryText = deliveryDate
      ? `Your cards will be delivered to the school for distribution by ${deliveryDate}.`
      : `Your cards will be delivered to ${claimed.school_name} for distribution.`
    const merchant = 'sq *Knight of Columbus Council #7689'
    const lineText = (lines || []).map((line) => `${line.quantity} × ${line.title}: ${money(line.line_total_cents)}`).join('\\n')
    const text = [
      `Thank you, ${name}.`,
      '',
      `Your CCIC ${claimed.school_name} fundraiser order ${claimed.order_number} has been received.`,
      '',
      'ORDER SUMMARY:',
      lineText,
      `Total Amount Paid: ${money(claimed.total_cents)}`,
      '',
      `Your payment card statement will show the merchant as ${merchant}.`,
      '',
      `${money(claimed.school_contribution_cents)} of this directly supports ${claimed.school_name}.`,
      '',
      deliveryText,
      '',
      'Sandbox test order. No real payment was taken.',
    ].join('\\n')
    const orderRows = (lines || []).map((line) =>
      `<tr><td style="padding:12px 0;border-bottom:1px solid #e9e5e1;color:#202020;">${line.quantity} × ${escapeHtml(line.title)}</td><td align="right" style="padding:12px 0;border-bottom:1px solid #e9e5e1;white-space:nowrap;color:#202020;">${money(line.line_total_cents)}</td></tr>`
    ).join('')
    const htmlContent = `<div style="margin:0;padding:32px 14px;background:#f7f6f4;font-family:Arial,Helvetica,sans-serif;color:#202020;">
      <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e0da;">
        <div style="padding:30px 34px 22px;text-align:center;border-bottom:1px solid #eeeae6;">
          <img src="https://chrismworks.com/CCiC.png" alt="CCIC" width="110" style="display:block;width:110px;height:auto;margin:0 auto;border:0;" />
          <p style="margin:16px 0 0;font-size:12px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:#925017;">School fundraiser confirmation</p>
        </div>
        <div style="padding:30px 34px 36px;">
          <p style="font-size:17px;margin:0 0 14px;">Thank you, ${escapeHtml(name)}.</p>
          <h1 style="font-size:25px;line-height:1.3;margin:0 0 28px;color:#202020;">Your CCIC ${escapeHtml(claimed.school_name)} fundraiser order ${escapeHtml(claimed.order_number)} has been received.</h1>
          <h2 style="font-size:14px;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px;color:#925017;">Order summary</h2>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;font-size:15px;">${orderRows}
            <tr><td style="padding:18px 0 8px;font-weight:bold;font-size:17px;">Total Amount Paid</td><td align="right" style="padding:18px 0 8px;font-weight:bold;font-size:20px;">${money(claimed.total_cents)}</td></tr>
          </table>
          <p style="font-size:14px;line-height:1.6;margin:22px 0;color:#55504a;">Your payment card statement will show the merchant as <strong>${escapeHtml(merchant)}</strong>.</p>
          <div style="padding:17px 19px;background:#f1f5ed;color:#315529;font-size:16px;line-height:1.5;font-weight:bold;">${money(claimed.school_contribution_cents)} of this directly supports ${escapeHtml(claimed.school_name)}.</div>
          <p style="font-size:15px;line-height:1.6;margin:22px 0 0;">${escapeHtml(deliveryText)}</p>
          <p style="font-size:12px;color:#77716b;margin:24px 0 0;padding-top:15px;border-top:1px solid #eeeae6;">Sandbox test order. No real payment was taken.</p>
        </div>
      </div>
    </div>`
    await sendBrevoTransactionalEmail({
      to: [{ email, name }],
      bcc: [
        { email: 'orders@ccic.supplies', name: 'CCIC Orders' },
        { email: 'ccic@kofc7689.org', name: 'CCIC' },
      ],
      subject: `CCIC ${claimed.school_name} order confirmation ${claimed.order_number}`,
      textContent: text,
      htmlContent,
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
