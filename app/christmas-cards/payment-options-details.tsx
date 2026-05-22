'use client'

import { useState } from 'react'

export default function PaymentOptionsDetails() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <span className="ccic-payment-sentence">
        <button type="button" className="ccic-inline-text-button" onClick={() => setIsOpen(true)}>
          Payment options <span aria-hidden="true" className="ccic-open-link-icon">↗</span>
        </button>{' '}
        best suited to you.
      </span>

      {isOpen ? (
        <div className="ccic-lightbox" role="dialog" aria-modal="true" aria-label="Payment options">
          <button type="button" className="ccic-lightbox-backdrop" aria-label="Close payment options" onClick={() => setIsOpen(false)} />
          <div className="ccic-lightbox-panel ccic-payment-panel">
            <div className="ccic-lightbox-header">
              <div>
                <p className="ccic-eyebrow">Payment options</p>
                <h2>Choose what works best</h2>
              </div>
              <button type="button" className="ccic-lightbox-close" onClick={() => setIsOpen(false)} aria-label="Close payment options">
                x
              </button>
            </div>

            <div className="ccic-payment-options-list">
              <section>
                <h3>E-transfer</h3>
                <p>After your order is reviewed, we can send the confirmed total and e-transfer details by email.</p>
              </section>
              <section>
                <h3>Cheque</h3>
                <p>Pay by cheque after your order is confirmed. Payee and mailing details will be included with your confirmation.</p>
              </section>
              <section>
                <h3>Square payment page</h3>
                <p>A Square payment link can be provided with your confirmed total before production begins.</p>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
