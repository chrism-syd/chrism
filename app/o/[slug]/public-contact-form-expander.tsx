'use client'

import { useEffect } from 'react'

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
    enhanceContactDetails()
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
        <p class="local-page-contact-reveal-kicker">Start here</p>
        <h3 class="local-page-contact-reveal-title">Let&apos;s start the conversation.</h3>
        <p class="local-page-contact-reveal-text">Whether you are interested in becoming a member, volunteering, or simply have a question, we would love to hear from you.</p>
      </div>
      <button type="button" class="qv-button-primary local-page-contact-reveal-button">Send us a message</button>
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
        const firstInput = form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input:not([type="hidden"]):not([tabindex="-1"]), textarea, select')
        firstInput?.focus()
      }, 120)
    })
  }, [])

  return (
    <style>{`
      .local-page-contact-form-card {
        transition: min-height 220ms ease, box-shadow 220ms ease, transform 220ms ease;
      }

      .local-page-contact-form-card.is-collapsed {
        align-content: center;
        min-height: clamp(360px, 38vw, 520px);
      }

      .local-page-contact-form-card.is-collapsed > div,
      .local-page-contact-form-card.is-collapsed > form {
        display: none;
      }

      .local-page-contact-form-card.is-transitioning {
        transform: translateY(2px);
      }

      .local-page-contact-reveal {
        display: grid;
        align-content: center;
        gap: 26px;
        min-height: 100%;
        animation: localPageRevealIn 220ms ease-out;
      }

      .local-page-contact-reveal-copy {
        display: grid;
        gap: 14px;
      }

      .local-page-contact-reveal-kicker {
        margin: 0;
        color: var(--local-page-primary-dark);
        font-size: 13px;
        font-weight: 900;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .local-page-contact-reveal-title {
        margin: 0;
        color: var(--local-page-primary-dark);
        font-size: clamp(38px, 4vw, 64px);
        font-weight: 900;
        letter-spacing: -0.05em;
        line-height: 0.95;
      }

      .local-page-contact-reveal-text {
        margin: 0;
        max-width: 42ch;
        color: var(--local-page-muted-text);
        font-size: clamp(17px, 1.2vw, 20px);
        line-height: 1.55;
      }

      .local-page-contact-reveal-button {
        justify-self: start;
      }

      .local-page-contact-form-card.is-expanded form,
      .local-page-contact-form-card.is-expanded > div {
        animation: localPageFormReveal 240ms ease-out;
      }

      .local-page-contact-detail {
        grid-template-columns: auto minmax(0, 1fr);
        column-gap: 12px;
        align-items: start;
      }

      .local-page-contact-detail-icon {
        grid-row: 1 / span 3;
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.62);
        color: var(--local-page-primary-dark);
        font-size: 17px;
        font-weight: 900;
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--local-page-primary) 12%, transparent);
      }

      .local-page-contact-detail:hover {
        border-color: color-mix(in srgb, var(--local-page-primary) 24%, transparent);
        background: rgba(255, 255, 255, 0.62);
      }

      .local-page-contact-detail-list {
        gap: 14px;
      }

      .local-page-contact-links {
        margin-top: 12px;
      }

      .local-page-story-visual {
        border-radius: 30px;
      }

      .local-page-story-placeholder {
        place-items: center start;
        align-content: end;
        gap: 8px;
      }

      .local-page-story-placeholder-kicker {
        color: var(--local-page-primary-dark);
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .local-page-story-placeholder strong {
        color: var(--local-page-primary-dark);
        font-size: clamp(24px, 2.5vw, 34px);
        letter-spacing: -0.035em;
        line-height: 1;
      }

      .local-page-story-placeholder span:last-child {
        max-width: 28ch;
        color: var(--local-page-muted-text);
        font-weight: 700;
        line-height: 1.35;
      }

      .local-page-gallery::after {
        content: 'View gallery';
        position: absolute;
        right: 16px;
        bottom: 16px;
        z-index: 3;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.82);
        color: var(--local-page-primary-dark);
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 0.03em;
        box-shadow: 0 8px 24px rgba(46, 42, 52, 0.16);
        backdrop-filter: blur(8px);
      }

      @keyframes localPageRevealIn {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes localPageFormReveal {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `}</style>
  )
}
