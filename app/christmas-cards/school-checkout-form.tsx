'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
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

export default function SchoolCheckoutForm({ schoolSlug, schoolCode, schoolName, orderingClosed }: { schoolSlug: string; schoolCode: string; schoolName: string; orderingClosed: boolean }) {
  const router = useRouter()
  const [draft, setDraft] = useState<CcicSchoolOrderDraft | null>(null)
  const [details, setDetails] = useState<CheckoutDetails>(EMPTY_DETAILS)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('')

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

  function submit(event: FormEvent) {
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
    setMessage('Your order details are ready. Online payment will be connected in the next step.')
  }

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

  return (
    <form className="ccic-school-checkout-layout" onSubmit={submit}>
      <div className="ccic-school-checkout-main">
        <button type="button" className="ccic-school-checkout-back" onClick={() => router.push(`/ccic/schools-2/${schoolSlug}`)}>← Back to card selection</button>
        <div>
          <p className="ccic-eyebrow">{schoolName} fundraiser</p>
          <h1>Checkout</h1>
          <p className="ccic-school-checkout-lead">Your order will be delivered to the school for distribution. No shipping address is needed.</p>
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
            <span>2</span><div><h2>School distribution</h2><p>This helps {schoolName} get the cards to the right family.</p></div>
          </div>
          <div className="ccic-school-checkout-fields">
            <label><span>Student name *</span><input value={details.studentName} onChange={(e) => update('studentName', e.target.value)} /></label>
            <label><span>Grade *</span><input value={details.grade} onChange={(e) => update('grade', e.target.value)} /></label>
            <label><span>Room number *</span><input value={details.roomNumber} onChange={(e) => update('roomNumber', e.target.value)} /></label>
            <label><span>Teacher name *</span><input value={details.teacherName} onChange={(e) => update('teacherName', e.target.value)} /></label>
          </div>
          <p className="ccic-school-checkout-privacy">Student information is collected only to help distribute this fundraiser order at the school.</p>
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
        <p className="ccic-school-checkout-delivery"><strong>Delivery:</strong> Delivered to {schoolName} for distribution.</p>
        {message ? <p className="ccic-school-checkout-message" role="status">{message}</p> : null}
        <button type="submit" className="ccic-school-checkout-primary">Continue to payment</button>
        <p className="ccic-school-checkout-payment-note">Online payment will be connected next. No payment is taken yet.</p>
      </aside>
    </form>
  )
}
