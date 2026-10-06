'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'

export default function CcicContactForm() {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const openedAtRef = useRef<number>(0)

  useEffect(() => {
    if (!isOpen) return
    openedAtRef.current = Date.now()

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    const formElement = event.currentTarget
    const form = new FormData(formElement)

    setIsSubmitting(true)
    setResult(null)

    try {
      const response = await fetch('/api/ccic/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: String(form.get('name') || ''),
          organization: String(form.get('organization') || ''),
          email: String(form.get('email') || ''),
          phone: String(form.get('phone') || ''),
          message: String(form.get('message') || ''),
          website: String(form.get('website') || ''),
          elapsedMs: Math.max(0, Date.now() - openedAtRef.current),
        }),
      })

      const body = await response.json() as { error?: string }

      if (!response.ok) {
        throw new Error(body.error || 'We could not send your message. Please try again.')
      }

      formElement.reset()
      setResult({
        type: 'success',
        message: 'Thanks. Your message has been sent to CCIC.',
      })
    } catch (error) {
      setResult({
        type: 'error',
        message: error instanceof Error ? error.message : 'We could not send your message. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button type="button" className="ccic-footer-contact" onClick={() => setIsOpen(true)}>
        Contact CCIC
      </button>

      {isOpen ? (
        <div className="ccic-lightbox ccic-contact-lightbox" role="dialog" aria-modal="true" aria-labelledby="ccic-contact-title">
          <button
            type="button"
            className="ccic-lightbox-backdrop"
            aria-label="Close contact form"
            onClick={() => setIsOpen(false)}
          />

          <div className="ccic-lightbox-panel ccic-contact-panel">
            <div className="ccic-lightbox-header">
              <div>
                <p className="ccic-eyebrow">Get in touch</p>
                <h2 id="ccic-contact-title">Contact CCIC</h2>
              </div>
              <button
                type="button"
                className="ccic-lightbox-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close contact form"
              >
                ×
              </button>
            </div>

            <form className="ccic-contact-form" onSubmit={submitContact}>
              <p className="ccic-contact-intro">
                Have a question about cards, pickup, shipping, or the CCIC program? Send us a message.
              </p>

              <label>
                Name
                <input name="name" type="text" autoComplete="name" required maxLength={120} />
              </label>

              <label>
                Organization <span className="ccic-form-optional">(optional)</span>
                <input name="organization" type="text" autoComplete="organization" maxLength={160} />
              </label>

              <label>
                Email address
                <input name="email" type="email" autoComplete="email" required maxLength={254} />
              </label>

              <label>
                Phone number <span className="ccic-form-optional">(optional)</span>
                <input name="phone" type="tel" autoComplete="tel" maxLength={40} />
              </label>

              <label>
                Message
                <textarea name="message" required maxLength={3000} rows={7} />
              </label>

              <label className="ccic-contact-honeypot" aria-hidden="true">
                Website
                <input name="website" type="text" tabIndex={-1} autoComplete="off" />
              </label>

              <button className="ccic-primary-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Sending…' : 'Send message'}
              </button>

              {result ? (
                <p className={`ccic-contact-result is-${result.type}`} role="status">
                  {result.message}
                </p>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
