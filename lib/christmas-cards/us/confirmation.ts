export const CCIC_US_HANDLING_CENTS = 200
export const CCIC_US_QUOTE_TARGET_HOURS = 24
export const CCIC_US_QUOTE_MAX_HOURS = 48
export const CCIC_US_CONFIRMATION_WINDOW_HOURS = 48

export type CcicUsConfirmationStatus =
  | 'awaiting_shipping_quote'
  | 'awaiting_customer_confirmation'
  | 'confirmed'
  | 'expired'
  | 'cancelled'

export function ccicUsConfirmationDeadline(from = new Date()) {
  return new Date(from.getTime() + CCIC_US_CONFIRMATION_WINDOW_HOURS * 60 * 60 * 1000)
}

export function ccicUsQuotePromiseCopy() {
  return 'We’ll calculate your final shipping and import costs within 24 hours whenever possible. In some cases, this may take up to 48 hours. Once your final total is ready, we’ll email you a link to review and confirm your order. You’ll have 48 hours from that email to confirm.'
}
