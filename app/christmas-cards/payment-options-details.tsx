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
            <div className="ccic-payment-close-row">
              <button type="button" className="ccic-lightbox-close" onClick={() => setIsOpen(false)} aria-label="Close payment options">
                ×
              </button>
            </div>

            <div className="ccic-lightbox-header ccic-payment-header">
              <div>
                <p className="ccic-eyebrow">Payment options</p>
                <h2>Choose what works best</h2>
              </div>
            </div>

            <div className="ccic-payment-options-list">
              <section>
                <h3>E-transfer</h3>
                <p>
                  Please send an e-transfer for the amount of your order when your order is placed. Send payment to{' '}
                  <a href="mailto:treasurer@kofc7689.org">treasurer@kofc7689.org</a> and include your order number in the e-transfer message.
                </p>
              </section>
              <section>
                <h3>Cheque</h3>
                <p>
                  <strong>Make cheque payable to:</strong><br />
                  Knights of Columbus #7689
                </p>
                <p>
                  <strong>Mail to:</strong><br />
                  Kerry Mendonca, CCIC<br />
                  37 White Ash Drive<br />
                  Markham, ON L3P 4N1
                </p>
                <p>Please include your CCIC order number in the Memo field.</p>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
