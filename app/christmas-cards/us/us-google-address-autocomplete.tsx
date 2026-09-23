'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'

type AddressComponent = { longText?: string; shortText?: string; types?: string[] }
type SelectedPlace = { addressComponents?: AddressComponent[]; fetchFields: (options: { fields: string[] }) => Promise<void> }
type PlacePrediction = { toPlace: () => SelectedPlace }
type PlaceSelectEvent = Event & { placePrediction?: PlacePrediction }
type PlaceAutocompleteElement = HTMLElement & { includedRegionCodes: string[]; placeholder: string }
type GoogleMapsWindow = Window & { google?: { maps?: { places?: { PlaceAutocompleteElement?: new () => PlaceAutocompleteElement } } } }

export type CcicUsSelectedAddress = { addressLine1: string; city: string; state: string; postalCode: string }
type Props = { onAddressSelected?: (address: CcicUsSelectedAddress) => void; onUnavailable?: () => void }

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const SLOW_LOAD_MS = 4000
function value(components: AddressComponent[], type: string) { return components.find((item) => item.types?.includes(type))?.longText || '' }
function shortValue(components: AddressComponent[], type: string) { return components.find((item) => item.types?.includes(type))?.shortText || '' }
function setFormField(name: string, fieldValue: string) {
  if (!fieldValue) return
  const field = document.querySelector<HTMLInputElement>(`input[name="${name}"]`)
  if (!field) return
  field.value = fieldValue
  field.dispatchEvent(new Event('input', { bubbles: true }))
  field.dispatchEvent(new Event('change', { bubbles: true }))
}

export default function UsGoogleAddressAutocomplete({ onAddressSelected, onUnavailable }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef(onAddressSelected)
  const unavailableRef = useRef(onUnavailable)
  const readyRef = useRef(false)
  const fallbackShownRef = useRef(false)
  const [scriptReady, setScriptReady] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => { selectedRef.current = onAddressSelected }, [onAddressSelected])
  useEffect(() => { unavailableRef.current = onUnavailable }, [onUnavailable])

  function showFallback(message: string) {
    if (fallbackShownRef.current) return
    fallbackShownRef.current = true
    setStatus(message)
    unavailableRef.current?.()
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const Ctor = (window as GoogleMapsWindow).google?.maps?.places?.PlaceAutocompleteElement
      if (Ctor) { readyRef.current = true; setScriptReady(true) }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!GOOGLE_MAPS_API_KEY) return showFallback('Address search is unavailable. Please enter your U.S. shipping address below.')
      if (!readyRef.current) showFallback('Address search is taking longer than expected. Please enter your U.S. shipping address below.')
    }, GOOGLE_MAPS_API_KEY ? SLOW_LOAD_MS : 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !scriptReady || !hostRef.current) return
    const host = hostRef.current
    let disposed = false
    let retryTimer: number | null = null
    let attempts = 0

    function initialize() {
      if (disposed) return
      const Ctor = (window as GoogleMapsWindow).google?.maps?.places?.PlaceAutocompleteElement
      if (!Ctor) {
        attempts += 1
        if (attempts <= 20) { retryTimer = window.setTimeout(initialize, 100); return }
        showFallback('Address search is unavailable. Please enter your U.S. shipping address below.')
        return
      }

      readyRef.current = true
      setStatus('')
      const autocomplete = new Ctor()
      autocomplete.includedRegionCodes = ['us']
      autocomplete.placeholder = 'Start typing your U.S. address'
      autocomplete.setAttribute('aria-label', 'Search for your U.S. shipping address')
      autocomplete.style.width = '100%'
      autocomplete.addEventListener('gmp-select', async (event) => {
        try {
          const prediction = (event as PlaceSelectEvent).placePrediction
          if (!prediction) return
          const place = prediction.toPlace()
          await place.fetchFields({ fields: ['addressComponents'] })
          const components = place.addressComponents || []
          const streetAddress = [value(components, 'street_number'), value(components, 'route')].filter(Boolean).join(' ')
          const city = value(components, 'locality') || value(components, 'postal_town') || value(components, 'sublocality_level_1')
          const state = shortValue(components, 'administrative_area_level_1')
          const postalCode = value(components, 'postal_code')
          const selected = { addressLine1: streetAddress, city, state, postalCode }
          setFormField('address_line_1', streetAddress)
          setFormField('city', city)
          setFormField('state', state)
          setFormField('postal_code', postalCode)
          selectedRef.current?.(selected)
          setStatus('Address found. Please review the details below.')
        } catch {
          showFallback('We could not fill that address automatically. Please enter your U.S. shipping address below.')
        }
      })
      host.replaceChildren(autocomplete)
    }

    initialize()
    return () => { disposed = true; if (retryTimer !== null) window.clearTimeout(retryTimer); host.replaceChildren() }
  }, [scriptReady])

  return <div className="ccic-google-address">{GOOGLE_MAPS_API_KEY ? <Script src={`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&loading=async&v=weekly&libraries=places`} strategy="afterInteractive" onReady={() => { readyRef.current = true; setScriptReady(true) }} onError={() => showFallback('Address search is unavailable. Please enter your U.S. shipping address below.')} /> : null}<label className="ccic-review-field-wide"><span>Find your address</span>{!scriptReady && !status ? <span className="ccic-google-address-loading">Loading address search…</span> : null}<div ref={hostRef} className="ccic-google-address-control" /></label>{status ? <p className="ccic-google-address-status" role="status">{status}</p> : null}</div>
}
