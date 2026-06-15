'use client'

import { useEffect } from 'react'

const STAR_SRC = '/chrism_star.png'
const RESTORE_DELAY_MS = 12000

function shouldReduceMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getPendingLabel(button: HTMLButtonElement) {
  const explicitLabel = button.dataset.pendingLabel?.trim()

  if (explicitLabel) {
    return explicitLabel
  }

  const label = button.textContent?.trim().toLowerCase() ?? ''

  if (label.includes('archive')) return 'Archiving…'
  if (label.includes('delete')) return 'Deleting…'
  if (label.includes('duplicate')) return 'Duplicating…'
  if (label.includes('remove')) return 'Removing…'
  if (label.includes('send')) return 'Sending…'
  if (label.includes('add')) return 'Adding…'
  if (label.includes('create')) return 'Creating…'
  if (label.includes('save')) return 'Saving…'

  return 'Working…'
}

function buildPendingContents(label: string) {
  const wrapper = document.createElement('span')
  wrapper.style.display = 'inline-flex'
  wrapper.style.alignItems = 'center'
  wrapper.style.justifyContent = 'center'
  wrapper.style.gap = '8px'

  const star = document.createElement('img')
  star.src = STAR_SRC
  star.alt = ''
  star.setAttribute('aria-hidden', 'true')
  star.style.width = '16px'
  star.style.height = '16px'
  star.style.objectFit = 'contain'
  star.style.flexShrink = '0'

  if (!shouldReduceMotion()) {
    star.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: 900, iterations: Infinity }
    )
  }

  const text = document.createElement('span')
  text.textContent = label

  wrapper.append(star, text)

  return wrapper
}

function restoreButton(button: HTMLButtonElement) {
  const originalHtml = button.dataset.pendingOriginalHtml
  const originalDisabled = button.dataset.pendingOriginalDisabled

  if (originalHtml !== undefined) {
    button.innerHTML = originalHtml
  }

  button.disabled = originalDisabled === 'true'
  button.removeAttribute('aria-busy')
  delete button.dataset.pendingOriginalHtml
  delete button.dataset.pendingOriginalDisabled
}

function applyPendingState(button: HTMLButtonElement) {
  if (button.dataset.pendingOriginalHtml !== undefined) {
    return
  }

  button.dataset.pendingOriginalHtml = button.innerHTML
  button.dataset.pendingOriginalDisabled = String(button.disabled)
  button.disabled = true
  button.setAttribute('aria-busy', 'true')
  button.replaceChildren(buildPendingContents(getPendingLabel(button)))

  window.setTimeout(() => {
    if (document.contains(button)) {
      restoreButton(button)
    }
  }, RESTORE_DELAY_MS)
}

export default function PendingSubmitEnhancer() {
  useEffect(() => {
    function handleSubmit(event: SubmitEvent) {
      const form = event.target instanceof HTMLFormElement ? event.target : null
      const button = event.submitter instanceof HTMLButtonElement ? event.submitter : null

      if (!form || !button || form.dataset.pendingSubmitEnhancer === 'off') {
        return
      }

      window.queueMicrotask(() => {
        if (!document.contains(button)) {
          return
        }

        applyPendingState(button)
      })
    }

    document.addEventListener('submit', handleSubmit)

    return () => document.removeEventListener('submit', handleSubmit)
  }, [])

  return null
}
