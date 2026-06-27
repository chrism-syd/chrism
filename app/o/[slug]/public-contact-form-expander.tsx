'use client'

import { useEffect } from 'react'

export default function PublicContactFormExpander() {
  useEffect(() => {
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
      card.classList.remove('is-collapsed')
      card.classList.add('is-expanded')
      reveal.remove()
      const firstInput = form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input:not([type="hidden"]):not([tabindex="-1"]), textarea, select')
      firstInput?.focus()
    })
  }, [])

  return (
    <style>{`
      .local-page-contact-form-card.is-collapsed {
        align-content: center;
        min-height: 100%;
      }

      .local-page-contact-form-card.is-collapsed > div,
      .local-page-contact-form-card.is-collapsed > form {
        display: none;
      }

      .local-page-contact-reveal {
        display: grid;
        align-content: center;
        gap: 24px;
        min-height: 100%;
      }

      .local-page-contact-reveal-copy {
        display: grid;
        gap: 12px;
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

      .local-page-contact-form-card.is-expanded {
        animation: localPageFormReveal 220ms ease-out;
      }

      @keyframes localPageFormReveal {
        from {
          opacity: 0.72;
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
