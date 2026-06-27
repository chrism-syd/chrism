'use client'

import { useEffect } from 'react'

const KNIGHTS_INVITATION_COPY = 'Join the 1.9 million Knights worldwide who lead, serve, protect, and defend. We share a desire to be better husbands, fathers, sons, neighbours, and role models. And to put charity and community first.'
const DEFAULT_INVITATION_COPY = 'Attend an event, learn more about this local organization, or get in touch.'

function enhanceContactCopy() {
  const contactCopy = document.querySelector<HTMLElement>('.local-page-contact-copy')
  if (!contactCopy || contactCopy.dataset.copyEnhanced === 'true') return

  const subtitle = contactCopy.querySelector<HTMLElement>('.qv-section-subtitle')
  if (!subtitle) return

  const isKnightsPage = Boolean(document.querySelector('.local-page-theme-knights'))
  subtitle.textContent = isKnightsPage ? KNIGHTS_INVITATION_COPY : DEFAULT_INVITATION_COPY
  contactCopy.dataset.copyEnhanced = 'true'
}

function enhanceContactDetails() {
  const details = Array.from(document.querySelectorAll<HTMLElement>('.local-page-contact-detail'))

  for (const detail of details) {
    if (detail.dataset.iconEnhanced === 'true') continue

    const label = detail.querySelector<HTMLElement>('.local-page-contact-detail-label')
    const labelText = label?.textContent?.trim().toLowerCase() ?? ''
    const icon = document.createElement('span')
    icon.className = 'local-page-contact-detail-icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.textContent = labelText.includes('email') ? '✉' : '⌖'
    detail.prepend(icon)
    detail.dataset.iconEnhanced = 'true'
  }
}

function enhanceContactFormCopy() {
  const submitButton = document.querySelector<HTMLButtonElement>('.local-page-contact-form button')
  if (submitButton && submitButton.textContent?.trim() === 'Send submission') {
    submitButton.textContent = 'Send'
  }

  const statusMessage = document.querySelector<HTMLElement>('.local-page-contact-form .qv-empty')
  if (statusMessage?.textContent?.includes('Your submission has been sent')) {
    statusMessage.textContent = 'Thanks! Your message has been sent to the council.'
  }
}

function enhanceGalleryEmptyState() {
  const placeholder = document.querySelector<HTMLElement>('.local-page-story-placeholder')
  if (!placeholder || placeholder.dataset.enhanced === 'true') return

  placeholder.dataset.enhanced = 'true'
  placeholder.innerHTML = `
    <span class="local-page-story-placeholder-kicker">Community gallery</span>
    <strong>Photos will appear here.</strong>
    <span>Upload curated images in settings to bring this local page to life.</span>
  `
}

export default function PublicContactFormExpander() {
  useEffect(() => {
    enhanceContactCopy()
    enhanceContactDetails()
    enhanceContactFormCopy()
    enhanceGalleryEmptyState()

    const card = document.querySelector<HTMLElement>('.local-page-contact-form-card')
    if (!card || card.dataset.enhanced === 'true') return

    const form = card.querySelector<HTMLFormElement>('form.local-page-contact-form')
    if (!form) return

    card.dataset.enhanced = 'true'

    const hasStatusMessage = new URLSearchParams(window.location.search).has('contact')
    if (hasStatusMessage) {
      card.classList.add('is-expanded')
      return
    }

    card.classList.add('is-collapsed')

    const reveal = document.createElement('div')
    reveal.className = 'local-page-contact-reveal'
    reveal.innerHTML = `
      <div class="local-page-contact-reveal-copy">
        <h3 class="local-page-contact-reveal-title">Get in touch.</h3>
        <p class="local-page-contact-reveal-text">Interested in becoming a Knight, looking to volunteer, or simply have a question? We'd be happy to hear from you.</p>
      </div>
      <button type="button" class="qv-button-primary local-page-contact-reveal-button">Contact the Council</button>
    `

    form.insertAdjacentElement('beforebegin', reveal)

    const button = reveal.querySelector<HTMLButtonElement>('.local-page-contact-reveal-button')
    button?.addEventListener('click', () => {
      card.classList.add('is-transitioning')
      window.setTimeout(() => {
        card.classList.remove('is-collapsed')
        card.classList.add('is-expanded')
        reveal.remove()
        window.setTimeout(() => card.classList.remove('is-transitioning'), 260)
      }, 120)
    })
  }, [])

  return null
}
