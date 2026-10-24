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

export default function SchoolCheckoutForm({ schoolSlug, schoolCode, schoolName, orderingClosed, orderingNotYetOpen, demonstrationOnly, deliveryByLabel, squareApplicationId, squareLocationId, squareEnvironment }: { schoolSlug: string; schoolCode: string; schoolName: string; orderingClosed: boolean; orderingNotYetOpen: boolean; demonstrationOnly: boolean; deliveryByLabel: string | null; squareApplicationId: string; squareLocationId: string; squareEnvironment: 'sandbox' | 'production' | null }) {
  const router = useRouter()
  // Keep parent and student information scoped to this school's checkout.
  const checkoutDetailsStorageKey = `${CCIC_SCHOOL_CHECKOUT_STORAGE_KEY}:${schoolSlug}`
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
    const storedDetails = window.sessionStorage.getItem(checkoutDetailsStorageKey)
    if (storedDetails) {
      try { setDetails({ ...EMPTY_DETAILS, ...JSON.parse(storedDetails) }) } catch {}
    }
    setReady(true)
  }, [schoolCode, schoolSlug, checkoutDetailsStorageKey])

  useEffect(() => {
    if (!ready) return
    window.sessionStorage.setItem(checkoutDetailsStorageKey, JSON.stringify(details))
  }, [checkoutDetailsStorageKey, details, ready])

  const calculated = useMemo(() => draft ? calculateCcicSchoolOrder(draft) : null, [draft])

  function update<K extends keyof CheckoutDetails>(key: K, value: CheckoutDetails[K]) {
    setDetails((current) => ({ ...current, [key]: value }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (demonstrationOnly || orderingClosed) return
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
      // Square's iframe can occasionally leave tokenization pending after a card error.
      // Bound this step so the button always becomes available for correction/retry.
      const tokenized = await Promise.race([
        cardRef.current.tokenize(),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error('Card validation timed out. Please check the card details and try again.')), 15000)
        }),
      ])
      if (tokenized.status !== 'OK' || !tokenized.token) throw new Error(tokenized.errors?.[0]?.message || 'Please check your card information.')
      const checkoutKeyStorage = `ccic-school-checkout-payment-key-v2:${schoolSlug}:${squareEnvironment}`
      let checkoutKey = window.sessionStorage.getItem(checkoutKeyStorage)
      if (!checkoutKey) {
        checkoutKey = crypto.randomUUID()
        window.sessionStorage.setItem(checkoutKeyStorage, checkoutKey)
      }
      const response = await fetch('/api/ccic/school-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolSlug, draft, details, sourceId: tokenized.token, checkoutKey }),
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
      window.sessionStorage.removeItem(checkoutDetailsStorageKey)
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

      const squareReady = () =>
        typeof (window as Window & {
          Square?: { payments?: unknown }
        }).Square?.payments === 'function'

      if (!squareReady()) {
        if (script?.dataset.failed === 'true') {
          script.remove()
          script = null
        }

        if (!script) {
          script = document.createElement('script')
          script.id = scriptId
          script.src = squareEnvironment === 'production' ? 'https://web.squarecdn.com/v1/square.js' : 'https://sandbox.web.squarecdn.com/v1/square.js'
          document.head.appendChild(script)
        }

        const activeScript = script

        await new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            window.clearTimeout(timeout)
            activeScript.removeEventListener('load', onLoad)
            activeScript.removeEventListener('error', onError)
          }

          const onLoad = () => {
            cleanup()
            if (squareReady()) {
              resolve()
            } else {
              activeScript.dataset.failed = 'true'
              reject(new Error('Square SDK unavailable after loading.'))
            }
          }

          const onError = () => {
            cleanup()
            activeScript.dataset.failed = 'true'
            reject(new Error('Square SDK failed to load.'))
          }

          const timeout = window.setTimeout(() => {
            cleanup()
            activeScript.dataset.failed = 'true'
            reject(new Error('Square SDK loading timed out.'))
          }, 15000)

          activeScript.addEventListener('load', onLoad, { once: true })
          activeScript.addEventListener('error', onError, { once: true })

          if (squareReady()) {
            cleanup()
            resolve()
          }
        })
      }

      if (cancelled) return

      const square = (window as unknown as {
        Square?: {
          payments: (
            appId: string,
            locationId: string
          ) => Promise<{
            card: () => Promise<{
              attach: (selector: string) => Promise<void>
              tokenize: () => Promise<{ status: string; token?: string }>
              destroy?: () => Promise<void>
            }>
          }>
        }
      }).Square

      if (!square) throw new Error('Square SDK unavailable.')

      const payments = await square.payments(squareApplicationId, squareLocationId)
      if (cancelled) return

      const card = await payments.card()

      if (cancelled) {
        await card.destroy?.()
        return
      }

      try {
        await card.attach('#ccic-school-square-card')
      } catch (error) {
        await card.destroy?.()
        throw error
      }

      if (cancelled) {
        await card.destroy?.()
        return
      }

      mountedCard = card
      cardRef.current = card
    }

    init().catch(() => {
      if (!cancelled) {
        setMessage('Secure card payment could not load. Please refresh and try again.')
      }
    })

    return () => {
      cancelled = true
      cardRef.current = null
      void mountedCard?.destroy?.()
    }
  }, [squareApplicationId, squareLocationId, squareEnvironment, ready, draft])

  if (demonstrationOnly) {
    return (
      <section className="ccic-school-checkout-empty" role="status">
        <p className="ccic-eyebrow">School program preview only</p>
        <h1>Ordering is not open</h1>
        <p>This is a demonstration of the {schoolName} fundraiser. Orders and payments are not being accepted.</p>
        <a className="ccic-school-checkout-primary ccic-school-closed-link" href={`/ccic/schools/${schoolSlug}`}>Back to collections</a>
      </section>
    )
  }

  if (orderingClosed) {
    return (
      <section className="ccic-school-checkout-empty">
        <p className="ccic-eyebrow">{orderingNotYetOpen ? 'Fundraiser coming soon' : 'Fundraiser complete'}</p>
        <h1>{orderingNotYetOpen ? 'School ordering has not opened yet' : 'School ordering is now closed'}</h1>
        <p>{orderingNotYetOpen ? `Orders for ${schoolName} will be accepted when the campaign opens.` : `Thank you for supporting ${schoolName}. Orders for this school fundraiser are no longer being accepted.`}</p>
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
        <button type="button" className="ccic-school-checkout-primary" onClick={() => router.push(`/ccic/schools/${schoolSlug}`)}>Back to fundraiser</button>
      </section>
    )
  }

  if (paidOrderNumber) {
    return (
      <section className="ccic-school-checkout-empty">
        <h1>Payment received</h1>

        <p>
          Thank you! Your {schoolName} Christmas card order has been confirmed.
        </p>

        <p>
          <strong>Order number:</strong> {paidOrderNumber}
        </p>

        <div className="ccic-school-checkout-summary">
          <h2>Order summary</h2>

          <div className="ccic-school-checkout-lines">
            {calculated.lines.map((line) => (
              <div key={line.catalogId} className="ccic-school-checkout-line">
                <span>
                  {line.quantity} × {line.title}
                </span>
                <strong>
                  {formatChristmasCardMoney(line.lineTotalCents)}
                </strong>
              </div>
            ))}
          </div>

          <div className="ccic-school-checkout-total">
            <span>Total paid</span>
            <strong>
              {formatChristmasCardMoney(calculated.totalCents)}
            </strong>
          </div>

          <div className="ccic-school-checkout-contribution">
            <span>Your purchase supports {schoolName}</span>
            <strong>
              {formatChristmasCardMoney(calculated.schoolContributionCents)}
            </strong>
          </div>
        </div>

        <p>
          Your Christmas cards will be delivered to {schoolName} for
          distribution{deliveryByLabel ? <> by <span style={{ whiteSpace: 'nowrap' }}>{deliveryByLabel.replace(/ /g, '\u00a0')}</span></> : null}.
        </p>

        <p>
          A confirmation email will be sent to your email address.
        </p>

        <p>
          Your card statement will show the merchant as{' '}
          <strong>sq *Knight of Columbus Council #7689</strong>.
        </p>

        <button
          type="button"
          className="ccic-school-checkout-button"
          onClick={() => router.push(`/ccic/schools/${schoolSlug}`)}
        >
          Back to Store
        </button>
      </section>
    )
  }

  return (
    <form className="ccic-school-checkout-layout" onSubmit={submit}>
      <div className="ccic-school-checkout-main">
        <button type="button" className="ccic-school-checkout-back" onClick={() => router.push(`/ccic/schools/${schoolSlug}`)}>← Back to card selection</button>
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
            <button type="submit" className="ccic-school-checkout-primary" disabled={processing || Boolean(submittedOrderNumber)}>{processing ? 'Processing…' : submittedOrderNumber ? 'Payment submitted' : squareEnvironment === 'sandbox' ? 'Pay securely (Sandbox)' : 'Pay securely'}</button>
            {squareEnvironment === 'sandbox' ? <p className="ccic-school-checkout-payment-note">Sandbox test payment only. No real card will be charged.</p> : null}
          </>
        ) : <p className="ccic-school-checkout-payment-note">Secure payment is not configured. No payment can be taken.</p>}
      </aside>
    </form>
  )
}
