'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import UsGoogleAddressAutocomplete, { type CcicUsSelectedAddress } from './us-google-address-autocomplete'
import { CHRISTMAS_CARD_BOXES, formatUsChristmasCardMoney } from '@/lib/christmas-cards/us/catalog'
import { CCIC_US_ORDER_DRAFT_STORAGE_KEY, calculateCcicUsOrder, parseCcicUsOrderDraftInput, type CcicOrderDraftInput } from '@/lib/christmas-cards/us/order'

type ShippingState =
  | { status: 'waiting' }
  | { status: 'calculating' }
  | { status: 'priced'; amountUsdCents: number; amountCadCents: number; carrierName: string; serviceName: string; transitDays: number | null; alternateCount: number }
  | { status: 'pending'; message: string }

function fieldValue(form: HTMLFormElement, key: string) {
  const value = new FormData(form).get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function readStoredDraft() {
  const value = window.sessionStorage.getItem(CCIC_US_ORDER_DRAFT_STORAGE_KEY)
  if (!value) return null
  try { return parseCcicUsOrderDraftInput(JSON.parse(value)) } catch { return null }
}

function addressFromForm(form: HTMLFormElement): CcicUsSelectedAddress {
  return {
    addressLine1: fieldValue(form, 'address_line_1'),
    city: fieldValue(form, 'city'),
    state: fieldValue(form, 'state').toUpperCase(),
    postalCode: fieldValue(form, 'postal_code'),
  }
}

function validAddress(address: CcicUsSelectedAddress) {
  return Boolean(address.addressLine1 && address.city && /^[A-Z]{2}$/.test(address.state) && /^\d{5}(?:-\d{4})?$/.test(address.postalCode))
}

export default function UsReviewOrderForm() {
  const [draft, setDraft] = useState<CcicOrderDraftInput | null | undefined>(undefined)
  const [shipping, setShipping] = useState<ShippingState>({ status: 'waiting' })
  const [showAddressFields, setShowAddressFields] = useState(false)
  const formRef = useRef<HTMLFormElement | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDraft(readStoredDraft()), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const order = useMemo(() => draft ? calculateCcicUsOrder(draft) : null, [draft])
  const accessoryIds = useMemo(() => new Set(CHRISTMAS_CARD_BOXES.filter((item) => item.isAccessory).map((item) => item.id)), [])
  const hasUnsupportedCustomsItems = Boolean(order && (order.nonCasePricingBoxCount > 0 || order.accessorySheetCount > 0))

  const requestRate = useCallback(async (address: CcicUsSelectedAddress) => {
    if (!draft || !order?.hasOrder || !validAddress(address)) { setShipping({ status: 'waiting' }); return }
    setShipping({ status: 'calculating' })
    try {
      const response = await fetch('/api/ccic/us/shipping/rates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ draft, ...address }),
      })
      const payload = await response.json().catch(() => null) as {
        available?: boolean
        message?: string
        rate?: { amountUsdCents?: number; amountCadCents?: number; carrierName?: string; serviceName?: string; expectedTransitTime?: number | null }
        rates?: unknown[]
      } | null
      if (response.ok && payload?.available && typeof payload.rate?.amountUsdCents === 'number' && typeof payload.rate.amountCadCents === 'number') {
        setShipping({
          status: 'priced',
          amountUsdCents: payload.rate.amountUsdCents,
          amountCadCents: payload.rate.amountCadCents,
          carrierName: payload.rate.carrierName || 'Carrier',
          serviceName: payload.rate.serviceName || 'Shipping',
          transitDays: typeof payload.rate.expectedTransitTime === 'number' ? payload.rate.expectedTransitTime : null,
          alternateCount: Math.max(0, (payload.rates?.length || 1) - 1),
        })
        return
      }
      setShipping({ status: 'pending', message: payload?.message || 'U.S. shipping could not be calculated.' })
    } catch {
      setShipping({ status: 'pending', message: 'U.S. shipping could not be calculated.' })
    }
  }, [draft, order])

  const selectedAddress = useCallback((address: CcicUsSelectedAddress) => {
    setShowAddressFields(true)
    void requestRate(address)
  }, [requestRate])

  if (draft === undefined) return <div className="ccic-review-loading">Loading your U.S. order…</div>
  if (!draft || !order?.hasOrder) return <section className="ccic-review-empty"><p className="ccic-eyebrow">U.S. store</p><h1>Your cart is empty</h1><p>Return to the U.S. collection and add the cards you would like to order.</p><Link className="ccic-review-primary-link" href="/ccic/us">Return to card selection</Link></section>

  const handlingCents = 200
  const currentTotal = order.subtotalCents + handlingCents

  return <div className="ccic-review-layout">
    <form ref={formRef} className="ccic-review-form" onSubmit={(event) => event.preventDefault()} onInput={(event) => {
      const target = event.target as HTMLInputElement
      if (['address_line_1','city','state','postal_code'].includes(target.name)) {
        const form = event.currentTarget
        window.clearTimeout(Number(form.dataset.rateTimer || 0))
        const timer = window.setTimeout(() => { const address = addressFromForm(form); if (validAddress(address)) void requestRate(address) }, 450)
        form.dataset.rateTimer = String(timer)
      }
    }}>
      <div className="ccic-review-heading"><p className="ccic-eyebrow">United States</p><h1>Review your order</h1><p>Submit your order request today. We’ll calculate your final shipping and import costs within 24 hours whenever possible. In some cases, this may take up to 48 hours. We’ll then email you a secure link to review the final amount, and you’ll have 48 hours to confirm your order.</p></div>

      <fieldset className="ccic-review-address"><legend>Shipping address</legend>
        <UsGoogleAddressAutocomplete onAddressSelected={selectedAddress} onUnavailable={() => setShowAddressFields(true)} />
        {!showAddressFields ? <button className="ccic-review-manual-address-toggle" type="button" onClick={() => setShowAddressFields(true)}>Enter address manually</button> : null}
        <div className={`ccic-review-address-fields${showAddressFields ? ' is-visible' : ''}`} aria-hidden={!showAddressFields}>
          <div className="ccic-review-fields">
            <label className="ccic-review-field-wide"><span>Address</span><input name="address_line_1" autoComplete="address-line1" required={showAddressFields} /></label>
            <label className="ccic-review-field-wide"><span>Unit, suite, or additional address details</span><input name="address_line_2" autoComplete="address-line2" /></label>
            <label><span>City</span><input name="city" autoComplete="address-level2" required={showAddressFields} /></label>
            <label><span>State</span><input name="state" autoComplete="address-level1" maxLength={2} placeholder="NY" required={showAddressFields} /></label>
            <label><span>ZIP code</span><input name="postal_code" autoComplete="postal-code" inputMode="numeric" maxLength={10} placeholder="14202" pattern="[0-9]{5}(-[0-9]{4})?" required={showAddressFields} /></label>
          </div>
        </div>
      </fieldset>

      {hasUnsupportedCustomsItems ? <p className="ccic-review-note"><strong>Customs test limitation:</strong> automated U.S. shipping is currently being validated for the standard Christmas card collection only. Prayer-card boxes and Christmas seals will be added after their customs classifications are confirmed.</p> : null}

      <div className="ccic-review-actions"><Link href="/ccic/us">Return to make changes</Link><button type="button" disabled>Submit order request coming next</button></div>
    </form>

    <aside className="ccic-review-summary" aria-label="U.S. order summary">
      <p className="ccic-eyebrow">Your order</p><h2>Order summary</h2>
      <div className="ccic-review-lines">{order.lines.map((line) => <div className="ccic-review-line" key={`${line.lineType}-${line.catalogId}`}><span>{line.quantity} × {line.title}</span><strong>{formatUsChristmasCardMoney(line.lineTotalCents)}</strong></div>)}</div>
      <div className="ccic-review-totals">
        <div><span>Subtotal</span><strong>{formatUsChristmasCardMoney(order.subtotalCents)}</strong></div>
        <div><span>Shipping & import</span><strong>Confirmed after review</strong></div>
        <div><span>Handling</span><strong>{formatUsChristmasCardMoney(handlingCents)}</strong></div>
        <div className="ccic-review-grand-total"><span>Current subtotal</span><strong>{formatUsChristmasCardMoney(currentTotal)}</strong></div>
      </div>
      {shipping.status === 'priced' ? <div className="ccic-review-shipping-status"><strong>{shipping.carrierName} · {shipping.serviceName}</strong><span>{shipping.transitDays ? `Estimated ${shipping.transitDays} business day${shipping.transitDays === 1 ? '' : 's'}` : 'Transit time unavailable'}{shipping.alternateCount ? ` · ${shipping.alternateCount} other rate${shipping.alternateCount === 1 ? '' : 's'} checked` : ''}</span><small>This carrier rate is for our shipping review only. Your final shipping and import amount will be emailed for approval before the order is confirmed.</small></div> : null}
      {shipping.status === 'pending' ? <p className="ccic-review-note">{shipping.message}</p> : null}
    </aside>
  </div>
}
