'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'

const CONTACT_FORM_CONTENT_ID = 'local-page-contact-form-content'

type PublicContactFormExpanderProps = {
  children: ReactNode
  initiallyExpanded?: boolean
}

export default function PublicContactFormExpander({ children, initiallyExpanded = false }: PublicContactFormExpanderProps) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded)
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isExpanded || initiallyExpanded) return

    const firstField = cardRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input[name="name"], textarea, select'
    )
    firstField?.focus()
  }, [initiallyExpanded, isExpanded])

  return (
    <div ref={cardRef} className={`local-page-contact-form-card ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
      {isExpanded ? (
        <div id={CONTACT_FORM_CONTENT_ID} className="local-page-contact-form-content">
          {children}
        </div>
      ) : (
        <div className="local-page-contact-reveal">
          <div className="local-page-contact-reveal-copy">
            <h3 className="local-page-contact-reveal-title">Get in touch.</h3>
            <p className="local-page-contact-reveal-text">
              Interested in becoming a Knight, looking to volunteer, or simply have a question? We&apos;d be happy to hear from you.
            </p>
          </div>
          <button
            type="button"
            className="qv-button-primary local-page-contact-reveal-button"
            aria-controls={CONTACT_FORM_CONTENT_ID}
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded(true)}
          >
            Contact the Council
          </button>
        </div>
      )}
    </div>
  )
}
