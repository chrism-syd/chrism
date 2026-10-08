'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatChristmasCardMoney } from '@/lib/christmas-cards/catalog'
import {
  CCIC_SCHOOL_CHECKOUT_STORAGE_KEY,
  CCIC_SCHOOL_ORDER_DRAFT_STORAGE_KEY,
  calculateCcicSchoolOrder,
  parseCcicSchoolOrderDraft,
  type CcicSchoolOrderDraft,
} from '@/lib/christmas-cards/school-order'

type CheckoutDetails = {
  parentName: string
  email: string
  phone: string
  studentName: string
  grade: string
  roomNumber: string
  teacherName: string
}

const EMPTY_DETAILS: CheckoutDetails = {
  parentName: '',
  email: '',
  phone: '',
  studentName: '',
  grade: '',
  roomNumber: '',
  teacherName: '',
}

export default function SchoolCheckoutForm({ schoolSlug, schoolCode, schoolName, orderingClosed, deliveryByLabel, squareApplicationId, squareLocationId }: { schoolSlug: string; schoolCode: string; schoolName: string; orderingClosed: boolean; deliveryByLabel: string | null; squareApplicationId: string; squareLocationId: string }) {
  const router = useRouter()
  const [draft, setDraft] = useState<CcicSchoolOrderDraft | null>(null)
  const [details, setDetails] = useState<CheckoutDetails>(EMPTY_DETAILS)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('')
  const [processing, setProcessing] = useState(false)
  const [paidOrderNumber, setPaidOrderNumber] = useState('')
  const [submittedOrderNumber, setSubmittedOrderNumber] = useState('')
  const cardRef = useRef<{ tokenize: () => Promise<{ status: string; token?: string; errors?: Array<{ message?: string }> }> } | null>(null)

  useEffect(() => {
    const storedDraft = window.sessionStorage.getItem(CCIC_SCHOOL_ORDER_DRAFT_STORAGE_KEY)
    if (storedDraft) {
      try {
        const parsed = parseCcicSchoolOrderDraft(JSON.parse(storedDraft))
        if (parsed?.schoolSlug === schoolSlug && parsed.schoolCode === schoolCode) setDraft(parsed)
      } catch {}
    }
    const storedDetails = window.sessionStorage.getItem(CCIC_SCHOOL_CHECKOUT_STORAGE_KEY)
    if (storedDetails) {
      try { setDetails({ ...EMPTY_DETAILS, ...JSON.parse(storedDetails) }) } catch {}
    }
    setReady(true)
  }, [schoolCode, schoolSlug])

  useEffect(() => {
    if (!ready) return
    window.sessionStorage.setItem(CCIC_SCHOOL_CHECKOUT_STORAGE_KEY, JSON.stringify(details))
  }, [details, ready])

  const calculated = useMemo(() => draft ? calculateCcicSchoolOrder(draft) : null, [draft])

  function update<K extends keyof CheckoutDetails>(key: K, value: CheckoutDetails[K]) {
    setDetails((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    if (!calculated?.hasOrder) {
      setMessage('Your cart is empty. Please return to the fundraiser page and choose at least one box.')
      return
    }
    const required: Array<[keyof CheckoutDetails, string]> = [
      ['parentName', 'Parent/guardian name'],
      ['email', 'Email'],
      ['studentName', 'Student name'],
      ['grade', 'Grade'],
      ['roomNumber', 'Room number'],
      ['teacherName', 'Teacher name'],
    ]
    const missing = required.find(([key]) => !details[key].trim())
    if (missing) {
      setMessage(`${missing[1]} is required.`)
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(details.email.trim())) {
      setMessage('Please enter a valid email address.')
      return
    }
    if (!cardRef.current) { setMessage('The secure payment form is still loading.'); return }
    setProcessing(true)
    try {
      const tokenized = await cardRef.current.tokenize()
      if (tokenized.status !== 'OK' || !tokenized.token) throw new Error(tokenized.errors?.[0]?.message || 'Please check your card information.')
      const checkoutKeyStorage = 'ccic-school-checkout-payment-key-v1'
      let checkoutKey = window.sessionStorage.getItem(checkoutKeyStorage)
      if (!checkoutKey) {
        checkoutKey = crypto.randomUUID()
        window.sessionStorage.setItem(checkoutKeyStorage, checkoutKey)
      }
      const response = await fetch('/api/ccic/school-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft, details, sourceId: tokenized.token, checkoutKey }),
      })
      const rawResponse = await response.text()
      let result: { error?: string; paid?: boolean; orderNumber?: string } = {}
      if (rawResponse) {
        try {
          result = JSON.parse(rawResponse) as { error?: string; paid?: boolean; orderNumber?: string }
        } catch {
          throw new Error(`Payment service returned an invalid response (HTTP ${response.status}). Please do not retry until we verify the transaction.`)
        }
      }
      if (result.orderNumber) setSubmittedOrderNumber(result.orderNumber)
      if (!response.ok || !result.paid) throw new Error(result.error || `Payment could not be confirmed (HTTP ${response.status}). Please contact us before retrying.`)
      setPaidOrderNumber(result.orderNumber || '')
      window.sessionStorage.removeItem(CCIC_SCHOOL_ORDER_DRAFT_STORAGE_KEY)
      window.sessionStorage.removeItem(CCIC_SCHOOL_CHECKOUT_STORAGE_KEY)
      window.sessionStorage.removeItem(checkoutKeyStorage)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Payment could not be completed.')
    } finally { setProcessing(false) }
  }

  useEffect(() => {
    if (!squareApplicationId || !squareLocationId || !ready || !draft) return
    let cancelled = false
    let mountedCard: { destroy?: () => Promise<void> } | null = null
    const init = async () => {
      const scriptId = 'ccic-square-web-payments'
      let script = document.getElementById(scriptId) as HTMLScriptElement | null
      if (!script) {
        script = document.createElement('script')
        script.id = scriptId
        script.src = 'https://sandbox.web.squarecdn.com/v1/square.js'
        document.head.appendChild(script)
      }
      if (!script.dataset.loaded) {
        await new Promise<void>((resolve, reject) => {
          if (script?.dataset.loaded) return resolve()
          script?.addEventListener('load', () => resolve(), { once: true })
          script?.addEventListener('error', () => reject(new Error('Square payment form could not load.')), { once: true })
        })
        script.dataset.loaded = 'true'
      }
      const square = (window as unknown as { Square?: { payments: (appId: string, locationId: string) => Promise<{ card: () => Promise<{ attach: (selector: string) => Promise<void>; tokenize: () => Promise<{ status: string; token?: string }> ; destroy?: () => Promise<void> }> }> } }).Square
      if (!square || cancelled) return
      const payments = await square.payments(squareApplicationId, squareLocationId)
      const card = await payments.card()
      if (cancelled) return
      await card.attach('#ccic-school-square-card')
      mountedCard = card
      cardRef.current = card
    }
    init().catch(() => { if (!cancelled) setMessage('Secure card payment could not load. Please refresh and try again.') })
    return () => { cancelled = true; cardRef.current = null; void mountedCard?.destroy?.() }
  }, [squareApplicationId, squareLocationId, ready, draft])

  if (orderingClosed) {
    return (
      <section className="ccic-school-checkout-empty">
        <p className="ccic-eyebrow">Fundraiser complete</p>
        <h1>School ordering is now closed</h1>
        <p>Thank you for supporting {schoolName}. Orders for this school fundraiser are no longer being accepted.</p>
        <a className="ccic-school-checkout-primary ccic-school-closed-link" href="/ccic">Shop CCIC Christmas Cards</a>
      </section>
    )
  }

  if (!ready) return <div className="ccic-school-checkout-loading">Loading your cart…</div>

  if (!calculated?.hasOrder) {
    return (
      <section className="ccic-school-checkout-empty">
        <h1>Your cart is empty</h1>
        <p>Return to the {schoolName} fundraiser and choose your Christmas card collections.</p>
        <button type="button" className="ccic-school-checkout-primary" onClick={() => router.push(`/ccic/schools-2/${schoolSlug}`)}>Back to fundraiser</button>
      </section>
    )
  }

  if (paidOrderNumber) return <section className="ccic-school-checkout-empty"><h1>Payment received</h1><p>Thank you. Your school fundraiser order <strong>{paidOrderNumber}</strong> is confirmed.</p><p>Your cards will be delivered to {schoolName} for distribution.</p></section>

  return (
    <form className="ccic-school-checkout-layout" onSubmit={submit}>
      <div className="ccic-school-checkout-main">
        <button type="button" className="ccic-school-checkout-back" onClick={() => router.push(`/ccic/schools-2/${schoolSlug}`)}>← Back to card selection</button>
        <div>
          <h1>Checkout</h1>
          <p className="ccic-school-checkout-lead">Your order will be delivered to the school for distribution.</p>
        </div>

        <section className="ccic-school-checkout-section">
          <div className="ccic-school-checkout-section-heading">
            <span>1</span><div><h2>Parent or guardian</h2><p>We’ll use this information for your order confirmation.</p></div>
          </div>
          <div className="ccic-school-checkout-fields">
            <label><span>Name *</span><input autoComplete="name" value={details.parentName} onChange={(e) => update('parentName', e.target.value)} /></label>
            <label><span>Email *</span><input type="email" autoComplete="email" value={details.email} onChange={(e) => update('email', e.target.value)} /></label>
            <label><span>Phone <small>(optional)</small></span><input type="tel" autoComplete="tel" value={details.phone} onChange={(e) => update('phone', e.target.value)} /></label>
          </div>
        </section>

        <section className="ccic-school-checkout-section">
          <div className="ccic-school-checkout-section-heading">
            <span>2</span><div><h2>Student/Classroom Information</h2><p>Student information is collected only to help sort and distribute the order at the school.</p></div>
          </div>
          <div className="ccic-school-checkout-fields">
            <label><span>Student name *</span><input value={details.studentName} onChange={(e) => update('studentName', e.target.value)} /></label>
            <label><span>Grade *</span><input value={details.grade} onChange={(e) => update('grade', e.target.value)} /></label>
            <label><span>Room number *</span><input value={details.roomNumber} onChange={(e) => update('roomNumber', e.target.value)} /></label>
            <label><span>Teacher name *</span><input value={details.teacherName} onChange={(e) => update('teacherName', e.target.value)} /></label>
          </div>
        </section>
      </div>

      <aside className="ccic-school-checkout-summary">
        <p className="ccic-eyebrow">Your order</p>
        <h2>Order summary</h2>
        <div className="ccic-school-checkout-lines">
          {calculated.lines.map((line) => (
            <div key={line.catalogId} className="ccic-school-checkout-line">
              <div><strong>{line.quantity} × {line.title.replace(' Mixed Box', '')}</strong><span>{line.quantity * 12} cards</span></div>
              <strong>{formatChristmasCardMoney(line.lineTotalCents)}</strong>
            </div>
          ))}
        </div>
        <div className="ccic-school-checkout-contribution"><span>Supports {schoolName}</span><strong>{formatChristmasCardMoney(calculated.schoolContributionCents)}</strong></div>
        <div className="ccic-school-checkout-total"><span>Total</span><strong>{formatChristmasCardMoney(calculated.totalCents)}</strong></div>
        {deliveryByLabel ? (
          <p className="ccic-school-checkout-delivery"><strong>Delivery by {deliveryByLabel}:</strong> Delivered to {schoolName} for distribution.</p>
        ) : (
          <p className="ccic-school-checkout-delivery"><strong>Delivery:</strong> Delivered to {schoolName} for distribution.</p>
        )}
        {message ? <p className="ccic-school-checkout-message" role="status">{message}</p> : null}
        {squareApplicationId && squareLocationId ? (
          <>
            <div id="ccic-school-square-card" aria-label="Secure card payment" />
            <button type="submit" className="ccic-school-checkout-primary" disabled={processing || Boolean(submittedOrderNumber)}>{processing ? 'Processing…' : submittedOrderNumber ? 'Payment submitted' : 'Pay securely (Sandbox)'}</button>
            <p className="ccic-school-checkout-payment-note">Sandbox test payment only. No real card will be charged.</p>
          </>
        ) : <p className="ccic-school-checkout-payment-note">Secure payment is not configured. No payment can be taken.</p>}
      </aside>
    </form>
  )
}
