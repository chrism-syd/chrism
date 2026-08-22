'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'

type AddressComponent = { longText?: string; shortText?: string; types?: string[] }
type SelectedPlace = { addressComponents?: AddressComponent[]; fetchFields: (options: { fields: string[] }) => Promise<void> }
type PlacePrediction = { toPlace: () => SelectedPlace }
type PlaceSelectEvent = Event & { placePrediction?: PlacePrediction }
type PlaceAutocompleteElement = HTMLElement & { includedRegionCodes: string[]; placeholder: string }
type GoogleMapsWindow = Window & { google?: { maps?: { places?: { PlaceAutocompleteElement?: new () => PlaceAutocompleteElement } } } }

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

function componentValue(components: AddressComponent[], type: string) {
  return components.find((item) => item.types?.includes(type))?.longText || ''
}

function setFormField(name: string, value: string) {
  if (!value) return
  const field = document.querySelector<HTMLInputElement>(`input[name="${name}"]`)
  if (!field) return
  field.value = value
  field.dispatchEvent(new Event('input', { bubbles: true }))
  field.dispatchEvent(new Event('change', { bubbles: true }))
}

export default function GoogleAddressAutocomplete({ onAddressSelected }: { onAddressSelected?: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const callbackRef = useRef(onAddressSelected)
  const [scriptReady, setScriptReady] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => { callbackRef.current = onAddressSelected }, [onAddressSelected])

  useEffect(() => {
    const PlaceAutocompleteElement = (window as GoogleMapsWindow).google?.maps?.places?.PlaceAutocompleteElement
    if (PlaceAutocompleteElement) setScriptReady(true)
  }, [])

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !scriptReady || !hostRef.current) return
    const host = hostRef.current
    let autocomplete: PlaceAutocompleteElement | null = null
    let disposed = false
    let retryTimer: number | null = null
    let attempts = 0

    function initialize() {
      if (disposed) return
      const PlaceAutocompleteElement = (window as GoogleMapsWindow).google?.maps?.places?.PlaceAutocompleteElement
      if (!PlaceAutocompleteElement) {
        attempts += 1
        if (attempts <= 20) {
          retryTimer = window.setTimeout(initialize, 100)
          return
        }
        console.error('CCIC Google address autocomplete failed to initialize: Google Places library is unavailable.')
        setStatus('Address search is unavailable right now. Please enter your address manually below.')
        return
      }

      autocomplete = new PlaceAutocompleteElement()
      autocomplete.includedRegionCodes = ['ca']
      autocomplete.placeholder = 'Start typing your Canadian address'
      autocomplete.setAttribute('aria-label', 'Search for your Canadian shipping address')
      autocomplete.style.width = '100%'
      autocomplete.addEventListener('gmp-select', async (event) => {
        try {
          const prediction = (event as PlaceSelectEvent).placePrediction
          if (!prediction) return
          const place = prediction.toPlace()
          await place.fetchFields({ fields: ['addressComponents'] })
          const components = place.addressComponents || []
          const streetAddress = [componentValue(components, 'street_number'), componentValue(components, 'route')].filter(Boolean).join(' ')
          const city = componentValue(components, 'locality') || componentValue(components, 'postal_town') || componentValue(components, 'sublocality_level_1')
          setFormField('address_line_1', streetAddress)
          setFormField('city', city)
          setFormField('province', componentValue(components, 'administrative_area_level_1'))
          setFormField('postal_code', componentValue(components, 'postal_code').toUpperCase())
          callbackRef.current?.()
          setStatus(streetAddress ? 'Address found. Please review the details below.' : 'Address found. Please review and complete the details below.')
        } catch (error) {
          console.error('CCIC Google address selection failed', error)
          setStatus('We could not fill that address automatically. Please enter it manually below.')
        }
      })
      host.replaceChildren(autocomplete)
    }

    initialize()
    return () => {
      disposed = true
      if (retryTimer !== null) window.clearTimeout(retryTimer)
      if (autocomplete?.parentNode === host) host.removeChild(autocomplete)
    }
  }, [scriptReady])

  if (!GOOGLE_MAPS_API_KEY) return null
  return (
    <div className="ccic-google-address">
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&loading=async&v=weekly&libraries=places`}
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <label className="ccic-review-field-wide">
        <span>Find your address</span>
        <div ref={hostRef} className="ccic-google-address-control">{!scriptReady ? <span className="ccic-google-address-loading">Loading address search…</span> : null}</div>
      </label>
      {status ? <p className="ccic-google-address-status" role="status">{status}</p> : null}
    </div>
  )
}
