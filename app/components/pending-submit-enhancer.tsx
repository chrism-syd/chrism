'use client'

import { useEffect } from 'react'

const STAR_SRC = '/chrism_star.png'
const RESTORE_DELAY_MS = 12000

function shouldReduceMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getPendingLabelText(label: string) {
  const normalizedLabel = label.trim().toLowerCase()

  if (normalizedLabel.includes('archive')) return 'Archiving…'
  if (normalizedLabel.includes('delete')) return 'Deleting…'
  if (normalizedLabel.includes('duplicate')) return 'Duplicating…'
  if (normalizedLabel.includes('remove')) return 'Removing…'
  if (normalizedLabel.includes('send')) return 'Sending…'
  if (normalizedLabel.includes('add')) return 'Adding…'
  if (normalizedLabel.includes('create')) return 'Creating…'
  if (normalizedLabel.includes('save')) return 'Saving…'
  if (normalizedLabel.includes('edit')) return 'Opening…'
  if (normalizedLabel.includes('view')) return 'Opening…'
  if (normalizedLabel.includes('open')) return 'Opening…'

  return 'Working…'
}

function getButtonPendingLabel(button: HTMLButtonElement) {
  const explicitLabel = button.dataset.pendingLabel?.trim()

  if (explicitLabel) {
    return explicitLabel
  }

  return getPendingLabelText(button.textContent ?? '')
}

function buildPendingStar() {
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

  return star
}

function buildPendingContents(label: string) {
  const wrapper = document.createElement('span')
  wrapper.style.display = 'inline-flex'
  wrapper.style.alignItems = 'center'
  wrapper.style.justifyContent = 'center'
  wrapper.style.gap = '8px'

  const text = document.createElement('span')
  text.textContent = label

  wrapper.append(buildPendingStar(), text)

  return wrapper
}

function buildCompactPendingContents() {
  const wrapper = document.createElement('span')
  wrapper.style.display = 'inline-grid'
  wrapper.style.placeItems = 'center'
  wrapper.style.minWidth = '1.25em'
  wrapper.append(buildPendingStar())

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

function restoreLink(link: HTMLAnchorElement) {
  const originalHtml = link.dataset.pendingOriginalHtml

  if (originalHtml !== undefined) {
    link.innerHTML = originalHtml
  }

  link.removeAttribute('aria-busy')
  link.removeAttribute('aria-disabled')
  delete link.dataset.pendingOriginalHtml
}

function applyButtonPendingState(button: HTMLButtonElement) {
  if (button.dataset.pendingOriginalHtml !== undefined) {
    return
  }

  button.dataset.pendingOriginalHtml = button.innerHTML
  button.dataset.pendingOriginalDisabled = String(button.disabled)
  button.disabled = true
  button.setAttribute('aria-busy', 'true')
  button.replaceChildren(buildPendingContents(getButtonPendingLabel(button)))

  window.setTimeout(() => {
    if (document.contains(button)) {
      restoreButton(button)
    }
  }, RESTORE_DELAY_MS)
}

function applyLinkPendingState(link: HTMLAnchorElement) {
  if (link.dataset.pendingOriginalHtml !== undefined) {
    return
  }

  link.dataset.pendingOriginalHtml = link.innerHTML
  link.setAttribute('aria-busy', 'true')
  link.setAttribute('aria-disabled', 'true')
  link.replaceChildren(buildCompactPendingContents())

  window.setTimeout(() => {
    if (document.contains(link)) {
      restoreLink(link)
    }
  }, RESTORE_DELAY_MS)
}

function shouldEnhanceLink(event: MouseEvent, link: HTMLAnchorElement) {
  if (link.dataset.pendingLinkEnhancer === 'off') {
    return false
  }

  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
    return false
  }

  if (link.target && link.target !== '_self') {
    return false
  }

  if (link.hasAttribute('download')) {
    return false
  }

  const href = link.getAttribute('href')
  if (!href || href.startsWith('#')) {
    return false
  }

  const url = new URL(href, window.location.href)
  const currentUrl = new URL(window.location.href)

  return (
    url.origin === currentUrl.origin &&
    (url.pathname !== currentUrl.pathname || url.search !== currentUrl.search)
  )
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

        applyButtonPendingState(button)
      })
    }

    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null
      const link = target?.closest('a.qv-link-button')

      if (!(link instanceof HTMLAnchorElement) || !shouldEnhanceLink(event, link)) {
        return
      }

      applyLinkPendingState(link)
    }

    document.addEventListener('submit', handleSubmit)
    document.addEventListener('click', handleClick, { capture: true })

    return () => {
      document.removeEventListener('submit', handleSubmit)
      document.removeEventListener('click', handleClick, { capture: true })
    }
  }, [])

  return null
}
