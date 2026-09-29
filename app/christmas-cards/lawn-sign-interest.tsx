'use client'

import Image from 'next/image'
import { FormEvent, useEffect, useState } from 'react'

const PRICE_PER_SET_CENTS = 16000

export default function LawnSignInterest() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeImage, setActiveImage] = useState<'mockup' | 'artwork'>('mockup')
  const [sets, setSets] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  async function submitInterest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setResult(null)

    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const payload = {
      contactName: String(form.get('contactName') || ''),
      organizationName: String(form.get('organizationName') || ''),
      email: String(form.get('email') || ''),
      phone: String(form.get('phone') || ''),
      sets,
      shippingPostalCode: String(form.get('shippingPostalCode') || ''),
    }

    try {
      const response = await fetch('/api/ccic/lawn-sign-interest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error || 'We could not send your request. Please try again.')

      setResult({
        type: 'success',
        message: String(form.get('shippingPostalCode') || '').trim()
          ? 'Thanks. Your lawn sign request has been sent. We will follow up by email with availability, timing, and a shipping estimate.'
          : 'Thanks. Your lawn sign request has been sent. We will follow up by email to confirm availability, timing, and pickup.',
      })

      formElement.reset()
      setSets(1)
    } catch (error) {
      setResult({
        type: 'error',
        message: error instanceof Error ? error.message : 'We could not send your request. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="ccic-lawn-sign-banner" aria-labelledby="ccic-lawn-sign-title">
      <button type="button" className="ccic-lawn-sign-preview" onClick={() => setIsOpen(true)} aria-label="View CCIC lawn sign details">
        <span className="ccic-lawn-sign-image">
          <Image src="/christmas-cards/CCIC_LawnSign_24x18_artwork.png" alt="CCIC lawn sign artwork" fill sizes="(max-width: 640px) 100vw, 320px" />
        </span>
        <span className="ccic-quick-view">View details</span>
      </button>

      <div className="ccic-lawn-sign-copy">
        <p className="ccic-eyebrow">Printed on demand</p>
        <h2 id="ccic-lawn-sign-title">CCIC Lawn Signs</h2>
        <p>Bring the Celebrate Christ in Christmas message outdoors with a lawn sign. H-stake included.</p>
        <strong>$160 per set of 10 <span>($16 per sign)</span></strong>
        <p className="ccic-lawn-sign-pickup">Available for Pickup only, in Markham.</p>
        <button type="button" className="ccic-lawn-sign-interest-button" onClick={() => setIsOpen(true)}>I'm interested in lawn signs</button>
      </div>

      {isOpen ? (
        <div className="ccic-lightbox ccic-lawn-sign-lightbox" role="dialog" aria-modal="true" aria-labelledby="ccic-lawn-sign-dialog-title">
          <button type="button" className="ccic-lightbox-backdrop" aria-label="Close lawn sign details" onClick={() => setIsOpen(false)} />

          <div className="ccic-lightbox-panel ccic-lawn-sign-panel">
            <div className="ccic-lightbox-header">
              <div>
                <p className="ccic-eyebrow">Printed on demand</p>
                <h2 id="ccic-lawn-sign-dialog-title">CCIC Lawn Signs</h2>
              </div>
              <button type="button" className="ccic-lightbox-close" onClick={() => setIsOpen(false)} aria-label="Close lawn sign details">×</button>
            </div>

            <div className="ccic-lawn-sign-dialog-grid">
              <div>
                <div className="ccic-lawn-sign-large-image">
                  <Image
                    src={activeImage === 'mockup' ? '/christmas-cards/ccic_24x18-yardsign-mockup.jpg' : '/christmas-cards/CCIC_LawnSign_24x18_artwork.png'}
                    alt={activeImage === 'mockup' ? 'CCIC lawn sign mockup' : 'CCIC lawn sign artwork'}
                    fill
                    sizes="(max-width: 900px) 92vw, 50vw"
                  />
                </div>

                <div className="ccic-lightbox-tabs" aria-label="Lawn sign preview images">
                  <button type="button" className={activeImage === 'mockup' ? 'is-active' : ''} onClick={() => setActiveImage('mockup')}>Mockup</button>
                  <button type="button" className={activeImage === 'artwork' ? 'is-active' : ''} onClick={() => setActiveImage('artwork')}>Artwork</button>
                </div>

                <div className="ccic-lawn-sign-specs">
                  <strong>24 × 18 in</strong>
                  <span>H-stake included</span>
                </div>
              </div>

              <form className="ccic-lawn-sign-form" onSubmit={submitInterest}>
                <div>
                  <p className="ccic-eyebrow">Request lawn signs</p>
                  <h3>Let us know how many you need.</h3>
                  <p>These signs are printed on demand and are expensive to ship. Because of this, we're suggesting pickup only. If you are interested in this being shipped to you, please continue to submit the request and we will follow up via email with a shipping estimate.</p>
                </div>

                <label>Contact name<input name="contactName" type="text" autoComplete="name" required maxLength={120} /></label>
                <label>Council / organization<input name="organizationName" type="text" autoComplete="organization" required maxLength={160} /></label>
                <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
                <label>Phone<input name="phone" type="tel" autoComplete="tel" required maxLength={40} /></label>

                <label>
                  Quantity
                  <select value={sets} onChange={(event) => setSets(Number(event.target.value))}>
                    {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
                      <option key={count} value={count}>{count} set{count === 1 ? '' : 's'} of 10 — ${((count * PRICE_PER_SET_CENTS) / 100).toFixed(0)}</option>
                    ))}
                  </select>
                </label>

                <label>
                  I would like a shipping estimate to
                  <input
                    name="shippingPostalCode"
                    type="text"
                    inputMode="text"
                    autoComplete="postal-code"
                    placeholder="Postal Code (optional)"
                    maxLength={12}
                  />
                </label>

                <div className="ccic-lawn-sign-total">
                  <span>Requested quantity</span>
                  <strong>{sets * 10} signs · ${((sets * PRICE_PER_SET_CENTS) / 100).toFixed(0)}</strong>
                </div>

                <button className="ccic-primary-button" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Sending…' : 'Send lawn sign request'}
                </button>

                {result ? <p className={`ccic-lawn-sign-result is-${result.type}`} role="status">{result.message}</p> : null}
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
