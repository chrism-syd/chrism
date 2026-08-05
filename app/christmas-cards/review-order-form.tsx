'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatChristmasCardMoney } from '@/lib/christmas-cards/catalog'
import {
  CCIC_ORDER_DRAFT_STORAGE_KEY,
  calculateCcicOrder,
  parseCcicOrderDraftInput,
  type CcicOrderDraftInput,
} from '@/lib/christmas-cards/order'

type SubmissionResult = {
  orderNumber: string
  confirmationEmailSent: boolean
}

function fieldValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

export default function ReviewOrderForm() {
  const [draftInput, setDraftInput] = useState<CcicOrderDraftInput | null | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SubmissionResult | null>(null)

  useEffect(() => {
    const storedDraft = window.sessionStorage.getItem(CCIC_ORDER_DRAFT_STORAGE_KEY)
    if (!storedDraft) {
      setDraftInput(null)
      return
    }

    try {
      setDraftInput(parseCcicOrderDraftInput(JSON.parse(storedDraft)))
    } catch {
      setDraftInput(null)
    }
  }, [])

  const calculatedOrder = useMemo(
    () => draftInput ? calculateCcicOrder(draftInput) : null,
    [draftInput]
  )

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draftInput || !calculatedOrder?.hasOrder) return

    setSubmitting(true)
    setError('')

    const formData = new FormData(event.currentTarget)
    const response = await fetch('/api/ccic/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        draft: draftInput,
        contact: {
          contactName: fieldValue(formData, 'contact_name'),
          organizationName: fieldValue(formData, 'organization_name'),
          email: fieldValue(formData, 'email'),
          phone: fieldValue(formData, 'phone'),
          addressLine1: fieldValue(formData, 'address_line_1'),
          addressLine2: fieldValue(formData, 'address_line_2'),
          city: fieldValue(formData, 'city'),
          province: fieldValue(formData, 'province'),
          postalCode: fieldValue(formData, 'postal_code'),
        },
      }),
    })

    const payload = await response.json().catch(() => null) as {
      error?: string
      orderNumber?: string
      confirmationEmailSent?: boolean
    } | null

    if (!response.ok || !payload?.orderNumber) {
      setError(payload?.error || 'We could not submit your order. Please try again.')
      setSubmitting(false)
      return
    }

    window.sessionStorage.removeItem(CCIC_ORDER_DRAFT_STORAGE_KEY)
    setResult({
      orderNumber: payload.orderNumber,
      confirmationEmailSent: Boolean(payload.confirmationEmailSent),
    })
    setSubmitting(false)
  }

  if (draftInput === undefined) {
    return <div className="ccic-review-loading">Loading your order…</div>
  }

  if (!draftInput || !calculatedOrder?.hasOrder) {
    return (
      <section className="ccic-review-empty">
        <p className="ccic-eyebrow">Your order</p>
        <h1>Your cart is empty</h1>
        <p>Return to the Christmas card collection and add the boxes you would like to order.</p>
        <Link className="ccic-review-primary-link" href="/ccic">Return to card selection</Link>
      </section>
    )
  }

  if (result) {
    return (
      <section className="ccic-review-success">
        <p className="ccic-eyebrow">Order received</p>
        <h1>Thank you. Your order request has been submitted.</h1>
        <p className="ccic-review-order-number">Order number: <strong>{result.orderNumber}</strong></p>
        <p>
          {result.confirmationEmailSent
            ? 'A copy of your order has been emailed to you. We will review it and follow up with payment and fulfilment details.'
            : 'Your order was saved successfully. We will review it and follow up with payment and fulfilment details.'}
        </p>
        <Link className="ccic-review-primary-link" href="/ccic">Return to the CCIC collection</Link>
      </section>
    )
  }

  const requiresAddress = draftInput.fulfillmentMethod === 'shipping'

  return (
    <div className="ccic-review-layout">
      <form className="ccic-review-form" onSubmit={submitOrder}>
        <div className="ccic-review-heading">
          <p className="ccic-eyebrow">Contact information</p>
          <h1>Review and submit your order</h1>
          <p>We will only use these details for communication about this order.</p>
        </div>

        <div className="ccic-review-fields">
          <label>
            <span>Your name</span>
            <input name="contact_name" autoComplete="name" required />
          </label>

          <label>
            <span>Organization name</span>
            <input name="organization_name" autoComplete="organization" required />
          </label>

          <label>
            <span>Email address</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>

          <label>
            <span>Phone number</span>
            <input name="phone" type="tel" autoComplete="tel" required />
          </label>
        </div>

        <fieldset className="ccic-review-address">
          <legend>
            {requiresAddress ? 'Shipping address' : 'Address (optional for pickup)'}
          </legend>
          <p>
            {requiresAddress
              ? 'Shipping was selected, so a complete delivery address is required.'
              : 'You may include an address now, or confirm pickup details with us later.'}
          </p>

          <div className="ccic-review-fields">
            <label className="ccic-review-field-wide">
              <span>Address</span>
              <input name="address_line_1" autoComplete="address-line1" required={requiresAddress} />
            </label>

            <label className="ccic-review-field-wide">
              <span>Unit, suite, or additional address details</span>
              <input name="address_line_2" autoComplete="address-line2" />
            </label>

            <label>
              <span>City</span>
              <input name="city" autoComplete="address-level2" required={requiresAddress} />
            </label>

            <label>
              <span>Province</span>
              <input name="province" autoComplete="address-level1" defaultValue="Ontario" required={requiresAddress} />
            </label>

            <label>
              <span>Postal code</span>
              <input name="postal_code" autoComplete="postal-code" required={requiresAddress} />
            </label>
          </div>
        </fieldset>

        {error ? <p className="ccic-review-error" role="alert">{error}</p> : null}

        <div className="ccic-review-actions">
          <Link href="/ccic">Return to card selection</Link>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Submitting order…' : 'Submit order request'}
          </button>
        </div>
      </form>

      <aside className="ccic-review-summary" aria-label="Order summary">
        <p className="ccic-eyebrow">Your order</p>
        <h2>Order summary</h2>

        <div className="ccic-review-lines">
          {calculatedOrder.lines.map((line) => (
            <div className="ccic-review-line" key={`${line.lineType}-${line.catalogId}`}>
              <span>{line.quantity} × {line.title}</span>
              <strong>{formatChristmasCardMoney(line.lineTotalCents)}</strong>
            </div>
          ))}

          {calculatedOrder.customCaseDiscountCents ? (
            <div className="ccic-review-line ccic-review-discount">
              <span>Custom Case pricing</span>
              <strong>−{formatChristmasCardMoney(calculatedOrder.customCaseDiscountCents)}</strong>
            </div>
          ) : null}
        </div>

        <div className="ccic-review-totals">
          <div><span>Subtotal</span><strong>{formatChristmasCardMoney(calculatedOrder.subtotalCents)}</strong></div>
          <div>
            <span>{draftInput.fulfillmentMethod === 'shipping' ? 'Shipping' : 'Pickup'}</span>
            <strong>{formatChristmasCardMoney(calculatedOrder.shippingCents)}</strong>
          </div>
          <div className="ccic-review-total"><span>Estimated total</span><strong>{formatChristmasCardMoney(calculatedOrder.totalCents)}</strong></div>
        </div>

        <p className="ccic-review-note">
          No payment is collected online. We will review the order and send payment instructions separately.
        </p>
      </aside>
    </div>
  )
}
