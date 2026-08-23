'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import ChrismPendingStar from '@/app/components/chrism-pending-star'
import GoogleAddressAutocomplete, { type CcicSelectedAddress } from './google-address-autocomplete'
import PaymentOptionsDetails from './payment-options-details'
import { CHRISTMAS_CARD_BOXES, CHRISTMAS_CARD_ORDER_CONFIG, formatChristmasCardMoney } from '@/lib/christmas-cards/catalog'
import { CCIC_ORDER_DRAFT_STORAGE_KEY, calculateCcicOrder, parseCcicOrderDraftInput, type CcicOrderDraftInput } from '@/lib/christmas-cards/order'

type SubmissionResult = { orderNumber: string; confirmationEmailSent: boolean; shippingStatus: 'pickup' | 'priced' | 'pending'; shippingCents: number; shippingServiceName: string | null; shippingTransitDays: number | null; totalCents: number }
type ShippingState = { status: 'waiting' } | { status: 'calculating' } | { status: 'priced'; amountCents: number; serviceName: string; transitDays: number | null } | { status: 'pending'; message: string }
const MANUAL_SHIPPING_MESSAGE = 'Shipping & Handling will be calculated after your order has been reviewed for packing. We will email you with the final amount before payment.'

function fieldValue(formData: FormData, key: string) { const value = formData.get(key); return typeof value === 'string' ? value.trim() : '' }
function normalizeCanadianPostalCode(value: string) { const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); return compact.length > 3 ? `${compact.slice(0, 3)} ${compact.slice(3)}` : compact }
function compactCanadianPostalCode(value: unknown) { return typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '') : '' }
function isCanadianPostalCode(value: unknown) { return /^[ABCEGHJ-NPRSTVXY][0-9][ABCEGHJ-NPRSTVWXYZ][0-9][ABCEGHJ-NPRSTVWXYZ][0-9]$/.test(compactCanadianPostalCode(value)) }
function readStoredDraft() { const storedDraft = window.sessionStorage.getItem(CCIC_ORDER_DRAFT_STORAGE_KEY); if (!storedDraft) return null; try { return parseCcicOrderDraftInput(JSON.parse(storedDraft)) } catch { return null } }
function addressFromForm(form: HTMLFormElement, postalCode?: string): CcicSelectedAddress { const data = new FormData(form); return { addressLine1: fieldValue(data, 'address_line_1'), city: fieldValue(data, 'city'), province: fieldValue(data, 'province'), postalCode: postalCode ?? fieldValue(data, 'postal_code') } }
function shippingRequestKey(address: CcicSelectedAddress, totalBoxes: number) { return [address.addressLine1.trim().toUpperCase(), address.city.trim().toUpperCase(), address.province.trim().toUpperCase(), compactCanadianPostalCode(address.postalCode), totalBoxes].join('|') }

export default function ReviewOrderForm() {
  const [draftInput, setDraftInput] = useState<CcicOrderDraftInput | null | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SubmissionResult | null>(null)
  const [showAddressFields, setShowAddressFields] = useState(false)
  const [shipping, setShipping] = useState<ShippingState>({ status: 'waiting' })
  const formRef = useRef<HTMLFormElement | null>(null)
  const lastShippingRequestRef = useRef<string | null>(null)
  const revealAddressFields = useCallback(() => setShowAddressFields(true), [])
  useEffect(() => { const timeoutId = window.setTimeout(() => setDraftInput(readStoredDraft()), 0); return () => window.clearTimeout(timeoutId) }, [])
  const calculatedOrder = useMemo(() => draftInput ? calculateCcicOrder(draftInput) : null, [draftInput])

  const caseEligibleBoxIds = useMemo(() => new Set(CHRISTMAS_CARD_BOXES.filter((box) => box.isCasePricingEligible).map((box) => box.id)), [])
  const selectedClassicLines = calculatedOrder?.lines.filter((line) => line.lineType === 'classic_case') ?? []
  const selectedIndividualLines = calculatedOrder?.lines.filter((line) => line.lineType === 'individual_box') ?? []
  const selectedCaseEligibleLines = selectedIndividualLines.filter((line) => caseEligibleBoxIds.has(line.catalogId))
  const nonCaseEligibleIndividualLines = selectedIndividualLines.filter((line) => !caseEligibleBoxIds.has(line.catalogId))
  const { customCaseLines, looseIndividualLines, looseCaseEligibleBoxCount } = useMemo(() => {
    if (!calculatedOrder) return { customCaseLines: [] as typeof selectedIndividualLines, looseIndividualLines: [] as typeof selectedIndividualLines, looseCaseEligibleBoxCount: 0 }
    let boxesToAllocateToCases = calculatedOrder.customCaseCount * CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase
    const customLines = [] as typeof selectedIndividualLines
    const looseLines = [] as typeof selectedIndividualLines
    let looseEligibleCount = 0
    for (const line of selectedCaseEligibleLines) {
      const customQuantity = Math.min(line.quantity, boxesToAllocateToCases)
      const looseQuantity = line.quantity - customQuantity
      if (customQuantity > 0) {
        customLines.push({ ...line, quantity: customQuantity, lineTotalCents: customQuantity * line.unitPriceCents })
        boxesToAllocateToCases -= customQuantity
      }
      if (looseQuantity > 0) {
        looseLines.push({ ...line, quantity: looseQuantity, lineTotalCents: looseQuantity * line.unitPriceCents })
        looseEligibleCount += looseQuantity
      }
    }
    return { customCaseLines: customLines, looseIndividualLines: looseLines, looseCaseEligibleBoxCount: looseEligibleCount }
  }, [calculatedOrder, selectedCaseEligibleLines, selectedIndividualLines])
  const progressPercent = Math.round((looseCaseEligibleBoxCount / CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase) * 100)

  const requestShippingRate = useCallback(async (address: CcicSelectedAddress, force = false) => {
    if (!calculatedOrder || !isCanadianPostalCode(address.postalCode) || !address.addressLine1 || !address.city || !address.province) { lastShippingRequestRef.current = null; setShipping({ status: 'waiting' }); return }
    const requestKey = shippingRequestKey(address, calculatedOrder.totalSelectedBoxes)
    if (!force && lastShippingRequestRef.current === requestKey) return
    lastShippingRequestRef.current = requestKey
    setShipping({ status: 'calculating' })
    try {
      const response = await fetch('/api/ccic/shipping/rates', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ postalCode: compactCanadianPostalCode(address.postalCode), addressLine1: address.addressLine1, city: address.city, province: address.province, totalBoxes: calculatedOrder.totalSelectedBoxes }) })
      const payload = await response.json().catch(() => null) as { available?: boolean; message?: string; rate?: { amountCents?: number; serviceName?: string; expectedTransitTime?: number | null } } | null
      if (response.ok && payload?.available && typeof payload.rate?.amountCents === 'number') { setShipping({ status: 'priced', amountCents: payload.rate.amountCents, serviceName: payload.rate.serviceName || 'Shipping', transitDays: typeof payload.rate.expectedTransitTime === 'number' ? payload.rate.expectedTransitTime : null }); return }
      setShipping({ status: 'pending', message: payload?.message || MANUAL_SHIPPING_MESSAGE })
    } catch { lastShippingRequestRef.current = null; setShipping({ status: 'pending', message: MANUAL_SHIPPING_MESSAGE }) }
  }, [calculatedOrder])

  const retryShippingRate = useCallback(() => {
    const form = formRef.current
    if (!form) return
    void requestShippingRate(addressFromForm(form), true)
  }, [requestShippingRate])

  const handleAutocompleteAddressSelected = useCallback((selected: CcicSelectedAddress | string) => {
    revealAddressFields()
    if (typeof selected === 'string') { const form = formRef.current; if (!form || !isCanadianPostalCode(selected)) { setShipping({ status: 'waiting' }); return }; void requestShippingRate(addressFromForm(form, selected)); return }
    if (isCanadianPostalCode(selected?.postalCode)) void requestShippingRate(selected); else setShipping({ status: 'waiting' })
  }, [requestShippingRate, revealAddressFields])

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draftInput || !calculatedOrder?.hasOrder || shipping.status === 'calculating') return
    setSubmitting(true); setError('')
    const formData = new FormData(event.currentTarget)
    const response = await fetch('/api/ccic/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ draft: draftInput, contact: { contactName: fieldValue(formData, 'contact_name'), organizationName: fieldValue(formData, 'organization_name'), email: fieldValue(formData, 'email'), phone: fieldValue(formData, 'phone'), addressLine1: fieldValue(formData, 'address_line_1'), addressLine2: fieldValue(formData, 'address_line_2'), city: fieldValue(formData, 'city'), province: fieldValue(formData, 'province'), postalCode: normalizeCanadianPostalCode(fieldValue(formData, 'postal_code')) } }) })
    const payload = await response.json().catch(() => null) as ({ error?: string } & Partial<SubmissionResult>) | null
    if (!response.ok || !payload?.orderNumber || typeof payload.totalCents !== 'number' || typeof payload.shippingCents !== 'number' || !payload.shippingStatus) { setError(payload?.error || 'We could not submit your order. Please try again.'); setSubmitting(false); return }
    window.sessionStorage.removeItem(CCIC_ORDER_DRAFT_STORAGE_KEY)
    setResult({ orderNumber: payload.orderNumber, confirmationEmailSent: Boolean(payload.confirmationEmailSent), shippingStatus: payload.shippingStatus, shippingCents: payload.shippingCents, shippingServiceName: payload.shippingServiceName ?? null, shippingTransitDays: payload.shippingTransitDays ?? null, totalCents: payload.totalCents })
    setSubmitting(false)
  }

  if (draftInput === undefined) return <div className="ccic-review-loading">Loading your order…</div>
  if (!draftInput || !calculatedOrder?.hasOrder) return <section className="ccic-review-empty"><p className="ccic-eyebrow">Your order</p><h1>Your cart is empty</h1><p>Return to the Christmas card collection and add the boxes you would like to order.</p><Link className="ccic-review-primary-link" href="/ccic">Return to card selection</Link></section>
  const requiresAddress = draftInput.fulfillmentMethod === 'shipping'
  const shippingCents = requiresAddress && shipping.status === 'priced' ? shipping.amountCents : 0
  const displayedTotalCents = calculatedOrder.subtotalCents + shippingCents
  const shippingPending = requiresAddress && shipping.status !== 'priced'
  const totalHeading = shippingPending ? 'Estimated total' : 'Total'

  if (result) {
    const resultShippingPending = result.shippingStatus === 'pending'
    const totalLabel = formatChristmasCardMoney(result.totalCents)
    return <section className="ccic-review-success"><p className="ccic-eyebrow">Order received</p><h1>Thank you. Your order request has been submitted.</h1><p className="ccic-review-order-number">Order number: <strong>{result.orderNumber}</strong></p><p>{result.confirmationEmailSent ? 'A copy of your order and these payment instructions has been emailed to you.' : 'Your order was saved successfully. Please keep the payment instructions below for your records.'}</p>{resultShippingPending ? <p className="ccic-review-note"><strong>Shipping & Handling is not yet priced.</strong> {MANUAL_SHIPPING_MESSAGE}</p> : null}<div className="ccic-review-payment-details"><div className="ccic-review-payment-heading"><p className="ccic-eyebrow">Payment options</p><h2>{resultShippingPending ? 'Payment details will follow' : 'Choose what works best'}</h2></div>{resultShippingPending ? <p>Please wait for our email confirming the Shipping & Handling amount and final total before sending payment.</p> : <div className="ccic-review-payment-grid"><section><h3>E-transfer</h3><p>Please send an e-transfer for <strong>{totalLabel}</strong> to <a href="mailto:treasurer@kofc7689.org">treasurer@kofc7689.org</a> and include your order number <strong>{result.orderNumber}</strong> in the e-transfer message.</p></section><section><h3>Cheque</h3><p><strong>Make cheque payable to:</strong><br />Knights of Columbus #7689</p><p><strong>Mail to:</strong><br />Kerry Mendonca, CCIC<br />37 White Ash Drive<br />Markham, ON L3P 4N1</p><p>Please include your CCIC order number <strong>{result.orderNumber}</strong> in the Memo field.</p></section></div>}</div><Link className="ccic-review-primary-link" href="/ccic">Return to the CCIC collection</Link></section>
  }

  return <div className="ccic-review-layout"><form ref={formRef} className="ccic-review-form" onSubmit={submitOrder} onInput={(event) => { const target = event.target as HTMLInputElement; if (target?.name === 'postal_code') { const formatted = normalizeCanadianPostalCode(target.value); target.value = formatted; if (isCanadianPostalCode(formatted)) void requestShippingRate(addressFromForm(event.currentTarget, formatted)); else { lastShippingRequestRef.current = null; setShipping({ status: 'waiting' }) } } }}><div className="ccic-review-heading"><p className="ccic-eyebrow">Contact information</p><h1>Review and submit your order</h1><p>We will only use these details for communication about this order.</p></div><div className="ccic-review-fields"><label><span>Your name</span><input name="contact_name" autoComplete="name" required /></label><label><span>Organization name</span><input name="organization_name" autoComplete="organization" required /></label><label><span>Email address</span><input name="email" type="email" autoComplete="email" required /></label><label><span>Phone number</span><input name="phone" type="tel" autoComplete="tel" required /></label></div>{requiresAddress ? <fieldset className="ccic-review-address"><legend>Shipping address</legend><GoogleAddressAutocomplete onAddressSelected={handleAutocompleteAddressSelected} onUnavailable={revealAddressFields} />{!showAddressFields ? <button className="ccic-review-manual-address-toggle" type="button" onClick={revealAddressFields}>Enter address manually</button> : null}<div className={`ccic-review-address-fields${showAddressFields ? ' is-visible' : ''}`} aria-hidden={!showAddressFields}><div className="ccic-review-fields"><label className="ccic-review-field-wide"><span>Address</span><input name="address_line_1" autoComplete="address-line1" required={showAddressFields} tabIndex={showAddressFields ? undefined : -1} /></label><label className="ccic-review-field-wide"><span>Unit, suite, or additional address details</span><input name="address_line_2" autoComplete="address-line2" tabIndex={showAddressFields ? undefined : -1} /></label><label><span>City</span><input name="city" autoComplete="address-level2" required={showAddressFields} tabIndex={showAddressFields ? undefined : -1} /></label><label><span>Province</span><input name="province" autoComplete="address-level1" defaultValue="ON" required={showAddressFields} tabIndex={showAddressFields ? undefined : -1} /></label><label><span>Postal code</span><input name="postal_code" autoComplete="postal-code" inputMode="text" maxLength={7} pattern="[ABCEGHJ-NPRSTVXY][0-9][ABCEGHJ-NPRSTVWXYZ] ?[0-9][ABCEGHJ-NPRSTVWXYZ][0-9]" placeholder="A1A 1A1" title="Enter a valid Canadian postal code, for example A1A 1A1." required={showAddressFields} tabIndex={showAddressFields ? undefined : -1} /></label></div></div></fieldset> : null}{error ? <p className="ccic-review-error" role="alert">{error}</p> : null}<div className="ccic-review-actions"><Link href="/ccic">Return to make changes</Link><button type="submit" disabled={submitting || shipping.status === 'calculating'}>{submitting ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><ChrismPendingStar size={16} />Submitting order…</span> : shipping.status === 'calculating' ? 'Calculating Shipping & Handling…' : 'Submit order request'}</button></div></form><aside className="ccic-review-summary" aria-label="Order summary"><p className="ccic-eyebrow">Your order</p><h2>Order summary</h2><div className="ccic-summary-scroll">
    {selectedClassicLines.length ? <div className="ccic-summary-section" style={{ borderTop: 0 }}><h3>Classic cases</h3>{selectedClassicLines.map((line) => <div className="ccic-summary-line" key={line.catalogId}><span>{line.quantity} × {line.title}</span><strong>{formatChristmasCardMoney(line.lineTotalCents)}</strong></div>)}</div> : null}
    {customCaseLines.length ? <div className="ccic-summary-section" style={!selectedClassicLines.length ? { borderTop: 0 } : undefined}><h3>{calculatedOrder.customCaseCount === 1 ? 'Custom case' : `Custom cases ×${calculatedOrder.customCaseCount}`}</h3>{customCaseLines.map((line) => <div className="ccic-summary-line" key={`custom-${line.catalogId}`}><span>{line.quantity} × {line.title}</span><strong>{formatChristmasCardMoney(line.lineTotalCents)}</strong></div>)}{calculatedOrder.customCaseDiscountCents ? <p className="ccic-good-news">Custom Case pricing saved {formatChristmasCardMoney(calculatedOrder.customCaseDiscountCents)}.</p> : null}</div> : null}
    {looseIndividualLines.length ? <div className="ccic-summary-section" style={!selectedClassicLines.length && !customCaseLines.length ? { borderTop: 0 } : undefined}><h3>Individual boxes</h3>{looseCaseEligibleBoxCount > 0 ? <div className="ccic-case-progress"><div className="ccic-case-progress-copy"><strong>{looseCaseEligibleBoxCount} of {CHRISTMAS_CARD_ORDER_CONFIG.boxesPerCase}</strong><span>boxes toward custom case</span></div><div className="ccic-progress-track" aria-hidden="true"><span style={{ width: `${progressPercent}%` }} /></div></div> : null}{looseIndividualLines.map((line) => <div className="ccic-summary-line" key={`loose-${line.catalogId}`}><span>{line.quantity} × {line.title}</span><strong>{formatChristmasCardMoney(line.lineTotalCents)}</strong></div>)}</div> : null}
    {nonCaseEligibleIndividualLines.length ? <div className="ccic-summary-section" style={!selectedClassicLines.length && !customCaseLines.length && !looseIndividualLines.length ? { borderTop: 0 } : undefined}><h3>Individual boxes (not eligible for case pricing)</h3>{nonCaseEligibleIndividualLines.map((line) => <div className="ccic-summary-line" key={`non-case-${line.catalogId}`}><span>{line.quantity} × {line.title}</span><strong>{formatChristmasCardMoney(line.lineTotalCents)}</strong></div>)}</div> : null}
  </div><div className="ccic-review-totals"><div><span>Subtotal</span><strong>{formatChristmasCardMoney(calculatedOrder.subtotalCents)}</strong></div>{!requiresAddress ? <div><span>Pickup</span><strong>{formatChristmasCardMoney(0)}</strong></div> : shipping.status === 'calculating' ? <div><span>Shipping & Handling</span><strong><span className="ccic-review-shipping-calculating"><ChrismPendingStar size={16} />Calculating…</span></strong></div> : shipping.status !== 'priced' ? <div><span>Shipping & Handling</span><strong>To be calculated</strong></div> : <div><span>Shipping & Handling</span><strong>{formatChristmasCardMoney(shipping.amountCents)}</strong></div>}<div className="ccic-review-total"><span>{totalHeading}</span><strong>{formatChristmasCardMoney(displayedTotalCents)}</strong></div></div>{requiresAddress && shipping.status === 'pending' ? <div className="ccic-review-shipping-warning" role="status"><strong>We couldn’t calculate Shipping & Handling right now.</strong><span>{shipping.message}</span><button type="button" onClick={retryShippingRate}>Retry calculation</button></div> : null}{requiresAddress && shipping.status === 'waiting' ? <p className="ccic-review-note">Enter your shipping address to calculate Shipping & Handling.</p> : null}<p className="ccic-review-note">No payment is collected online. <PaymentOptionsDetails linkText="Payment options can be viewed here" sentenceSuffix="and are included in the Order Confirmation email." /></p></aside></div>
}