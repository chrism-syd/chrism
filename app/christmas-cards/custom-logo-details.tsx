'use client'

import Image from 'next/image'
import { useState } from 'react'

export default function CustomLogoDetails() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button type="button" className="ccic-inline-details-button" onClick={() => setIsOpen(true)}>
        See logo file tips and placement preview
      </button>

      {isOpen ? (
        <div className="ccic-lightbox" role="dialog" aria-modal="true" aria-label="Custom logo and text details">
          <button type="button" className="ccic-lightbox-backdrop" aria-label="Close details" onClick={() => setIsOpen(false)} />
          <div className="ccic-lightbox-panel ccic-details-panel">
            <div className="ccic-lightbox-header">
              <div>
                <p className="ccic-eyebrow">Custom logo/text</p>
                <h2>What to send us</h2>
              </div>
              <button type="button" className="ccic-lightbox-close" onClick={() => setIsOpen(false)} aria-label="Close details">
                x
              </button>
            </div>

            <div className="ccic-details-grid">
              <div className="ccic-details-copy">
                <p>
                  After you submit your order, reply to the confirmation email with your logo file. We will confirm placement before production.
                </p>
                <ul>
                  <li>Best file types: PNG, SVG, PDF, or high-resolution JPG.</li>
                  <li>Use the clearest logo file you have. Larger files usually print better.</li>
                  <li>A transparent PNG is preferred when available.</li>
                  <li>Keep the custom line short so it remains readable on the card.</li>
                </ul>
              </div>
              <div className="ccic-placement-preview">
                <div className="ccic-placement-card">
                  <span className="ccic-placement-art">Back of card preview</span>
                  <span className="ccic-placement-zoom">Logo + custom line area</span>
                </div>
                <p>This preview shows the general area where your logo and short line of text can appear.</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
