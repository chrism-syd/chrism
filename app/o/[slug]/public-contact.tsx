import { submitPublicContactFormAction } from './actions'
import PublicContactFormExpander from './public-contact-form-expander'

type PublicContactDetail = {
  type: 'email' | 'location'
  label: string
  value?: string | null
  href?: string | null
  addressLines?: string[]
}

type PublicExternalLink = {
  id: string
  label: string
  url: string
}

type PublicContactProps = {
  displayName: string
  involvementText: string
  contactDetails: PublicContactDetail[]
  externalLinks: PublicExternalLink[]
  showContactForm: boolean
  canonicalSlug: string
  contactMessage: string | null
}

function contactDetailIcon(type: PublicContactDetail['type']) {
  if (type === 'email') return '✉'
  return '⌖'
}

export default function PublicContact({
  displayName,
  involvementText,
  contactDetails,
  externalLinks,
  showContactForm,
  canonicalSlug,
  contactMessage,
}: PublicContactProps) {
  const hasPublicContactDetails = contactDetails.length > 0

  return (
    <section id="contact" className="local-page-contact-section">
      <div className="local-page-contact-shell">
        <div className="local-page-contact-grid">
          <div className="local-page-contact-copy">
            <p className="qv-eyebrow">Get involved</p>
            <h2 className="qv-section-title local-page-contact-heading">Interested in what is happening at {displayName}?</h2>
            <p className="qv-section-subtitle local-page-contact-subtitle">{involvementText}</p>

            {hasPublicContactDetails ? (
              <div className="local-page-contact-detail-list" aria-label="Public contact details">
                {contactDetails.map((detail) => (
                  <div key={detail.type} className="local-page-contact-detail">
                    <span className="local-page-contact-detail-icon" aria-hidden="true">{contactDetailIcon(detail.type)}</span>
                    <span className="local-page-contact-detail-label">{detail.label}</span>
                    {detail.value ? (
                      <span className="local-page-contact-detail-value">
                        {detail.href ? (
                          <a href={detail.href} target={detail.type === 'location' ? '_blank' : undefined} rel={detail.type === 'location' ? 'noopener noreferrer' : undefined}>
                            {detail.value}
                          </a>
                        ) : (
                          detail.value
                        )}
                      </span>
                    ) : null}
                    {detail.addressLines && detail.addressLines.length > 0 ? (
                      <span className="local-page-contact-address-lines">
                        {detail.addressLines.map((line) => (
                          <span key={line}>{line}</span>
                        ))}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {externalLinks.length > 0 ? (
              <div className="local-page-contact-links">
                {externalLinks.map((externalLink) => (
                  <a
                    key={externalLink.id}
                    href={externalLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="qv-link-button qv-button-secondary"
                  >
                    {externalLink.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {showContactForm ? (
            <PublicContactFormExpander initiallyExpanded={Boolean(contactMessage)}>
              <div>
                <p className="qv-eyebrow">Contact the council</p>
                <h3 className="qv-section-title local-page-section-subtitle-tight">Send a message</h3>
              </div>
              <form action={submitPublicContactFormAction} className="qv-form-grid local-page-contact-form">
                <input type="hidden" name="slug" value={canonicalSlug} />
                <label className="local-page-visually-hidden-honeypot" aria-hidden="true">
                  Website
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
                {contactMessage ? <div className="qv-empty local-page-contact-status">{contactMessage}</div> : null}
                <div className="qv-form-row qv-form-row-2">
                  <label className="qv-control">
                    <span className="qv-label">Name</span>
                    <input name="name" autoComplete="name" required />
                  </label>
                  <label className="qv-control">
                    <span className="qv-label">Email</span>
                    <input name="email" type="email" autoComplete="email" required />
                  </label>
                </div>
                <div className="qv-form-row qv-form-row-2">
                  <label className="qv-control">
                    <span className="qv-label">Phone optional</span>
                    <input name="phone" autoComplete="tel" />
                  </label>
                  <label className="qv-control">
                    <span className="qv-label">Submission type</span>
                    <select name="inquiry_type" defaultValue="general_question">
                      <option value="volunteer">I want to volunteer</option>
                      <option value="membership">I&apos;m interested in joining</option>
                      <option value="general_question">I have a general question</option>
                      <option value="help_request">I need help with something</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                </div>
                <label className="qv-control">
                  <span className="qv-label">Message</span>
                  <textarea name="message" rows={4} required />
                </label>
                <p className="qv-inline-message">
                  By submitting this form, you agree that this organization may contact you about your submission.
                </p>
                <div className="qv-form-actions local-page-form-actions-start">
                  <button type="submit" className="qv-button-primary">Send</button>
                </div>
              </form>
            </PublicContactFormExpander>
          ) : null}
        </div>
      </div>
    </section>
  )
}
