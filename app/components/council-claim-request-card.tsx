'use client'

import { useActionState, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import type { CouncilClaimLookupOption } from '@/lib/organizations/claim-requests'
import {
  initialClaimOrganizationActionState,
  type ClaimOrganizationActionState,
} from '@/app/me/claim-organization/action-state'

type CouncilClaimRequestCardProps = {
  options: CouncilClaimLookupOption[]
  action: (
    prevState: ClaimOrganizationActionState,
    formData: FormData
  ) => Promise<ClaimOrganizationActionState>
  title: string
  description: string
  submitLabel: string
  audience: 'signed_in' | 'public'
  requesterNameDefault?: string | null
  requesterEmailDefault?: string | null
  requesterPhoneDefault?: string | null
  initialCouncilNumberQuery?: string | null
  initialCouncilNameQuery?: string | null
  initialCityQuery?: string | null
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="qv-button-primary" disabled={pending}>
      {pending ? 'Sending...' : label}
    </button>
  )
}

export default function CouncilClaimRequestCard({
  options, action, title, description, submitLabel, audience, requesterNameDefault,
  requesterEmailDefault, requesterPhoneDefault, initialCouncilNumberQuery, initialCouncilNameQuery, initialCityQuery,
}: CouncilClaimRequestCardProps) {
  const [state, formAction] = useActionState(action, initialClaimOrganizationActionState)
  const [councilNumberQuery, setCouncilNumberQuery] = useState(initialCouncilNumberQuery ?? '')
  const [councilNameQuery, setCouncilNameQuery] = useState(initialCouncilNameQuery ?? '')
  const [cityQuery, setCityQuery] = useState(initialCityQuery ?? '')
  const [selectedCouncilId, setSelectedCouncilId] = useState<string | null>(null)
  const [requestAccessMode, setRequestAccessMode] = useState(false)

  const hasSearchQuery =
    councilNumberQuery.trim().length > 0 ||
    councilNameQuery.trim().length > 0 ||
    cityQuery.trim().length > 0

  const filteredOptions = useMemo(() => {
    const councilNumber = normalize(councilNumberQuery)
    const councilName = normalize(councilNameQuery)
    const city = normalize(cityQuery)

    return options.filter((option) => {
      if (councilNumber && !option.councilNumber.toLowerCase().includes(councilNumber)) return false
      if (councilName && !option.councilName.toLowerCase().includes(councilName)) return false
      if (city && !(option.city ?? '').toLowerCase().includes(city)) return false
      return true
    })
  }, [cityQuery, councilNameQuery, councilNumberQuery, options])

  const selectedCouncil = selectedCouncilId
    ? options.find((option) => option.councilId === selectedCouncilId) ?? null
    : null

  function chooseCouncil(option: CouncilClaimLookupOption) {
    setSelectedCouncilId(option.councilId)
    setRequestAccessMode(false)
    setCouncilNumberQuery(option.councilNumber)
    setCouncilNameQuery(option.councilName)
    setCityQuery(option.city ?? '')
  }

  function enableRequestAccessMode() {
    setSelectedCouncilId(null)
    setRequestAccessMode(true)
  }

  const showResults = !selectedCouncil && !requestAccessMode && hasSearchQuery
  const showManualFields = requestAccessMode
  const showSelectedSummary = Boolean(selectedCouncil)

  return (
    <section className="qv-card" style={{ display: 'grid', gap: 18 }}>
      <div>
        <h1 className="qv-section-title" style={{ margin: 0 }}>{title}</h1>
        <p className="qv-section-subtitle" style={{ marginTop: 8 }}>{description}</p>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        <div className="qv-form-row" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <label className="qv-control">
            <span className="qv-label">Council number</span>
            <input
              type="text"
              value={councilNumberQuery}
              onChange={(event) => {
                setCouncilNumberQuery(event.target.value)
                setSelectedCouncilId(null)
                if (requestAccessMode) setRequestAccessMode(false)
              }}
              placeholder="e.g. 1388"
            />
          </label>

          <label className="qv-control">
            <span className="qv-label">Council name</span>
            <input
              type="text"
              value={councilNameQuery}
              onChange={(event) => {
                setCouncilNameQuery(event.target.value)
                setSelectedCouncilId(null)
                if (requestAccessMode) setRequestAccessMode(false)
              }}
              placeholder="e.g. St. Patrick's"
            />
          </label>

          <label className="qv-control">
            <span className="qv-label">City</span>
            <input
              type="text"
              value={cityQuery}
              onChange={(event) => {
                setCityQuery(event.target.value)
                setSelectedCouncilId(null)
                if (requestAccessMode) setRequestAccessMode(false)
              }}
              placeholder="e.g. Markham"
            />
          </label>
        </div>

        {showResults ? (
          <div className="qv-list" style={{ display: 'grid', gap: 10 }}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const location = [option.city, option.stateOrProvince].filter(Boolean).join(', ')
                return (
                  <button
                    key={option.councilId}
                    type="button"
                    className="qv-list-item"
                    onClick={() => chooseCouncil(option)}
                    style={{ textAlign: 'left' }}
                  >
                    <div style={{ fontWeight: 600 }}>{option.councilName} ({option.councilNumber})</div>
                    {location ? <div className="qv-text-muted">{location}</div> : null}
                  </button>
                )
              })
            ) : (
              <div className="qv-text-muted">No council matched your search yet.</div>
            )}
          </div>
        ) : null}

        {!requestAccessMode && !selectedCouncil ? (
          <button type="button" className="qv-button-secondary" onClick={enableRequestAccessMode}>
            Request Access
          </button>
        ) : null}

        <form action={formAction} className="qv-form" style={{ display: 'grid', gap: 14 }}>
          <input type="hidden" name="selected_council_id" value={selectedCouncil?.councilId ?? ''} />
          <input type="hidden" name="selected_organization_id" value={selectedCouncil?.organizationId ?? ''} />

          {showSelectedSummary ? (
            <div className="qv-card-subtle" style={{ display: 'grid', gap: 6 }}>
              <strong>{selectedCouncil?.councilName} ({selectedCouncil?.councilNumber})</strong>
              {[selectedCouncil?.city, selectedCouncil?.stateOrProvince].filter(Boolean).join(', ') ? (
                <span className="qv-text-muted">{[selectedCouncil?.city, selectedCouncil?.stateOrProvince].filter(Boolean).join(', ')}</span>
              ) : null}
            </div>
          ) : null}

          {showManualFields ? (
            <>
              <label className="qv-control">
                <span className="qv-label">Council number</span>
                <input type="text" name="requested_council_number" defaultValue={councilNumberQuery} />
              </label>

              <label className="qv-control">
                <span className="qv-label">Council name</span>
                <input type="text" name="requested_council_name" defaultValue={councilNameQuery} required />
              </label>

              <label className="qv-control">
                <span className="qv-label">City</span>
                <input type="text" name="requested_city" defaultValue={cityQuery} required />
              </label>
            </>
          ) : null}

          {audience === 'signed_in' ? (
            <label className="qv-control">
              <span className="qv-label">Your name</span>
              <input type="text" name="requester_name" defaultValue={requesterNameDefault ?? ''} />
            </label>
          ) : (
            <>
              <label className="qv-control">
                <span className="qv-label">Your name</span>
                <input type="text" name="requester_name" defaultValue={requesterNameDefault ?? ''} required />
              </label>

              <label className="qv-control">
                <span className="qv-label">Your email</span>
                <input type="email" name="requester_email" defaultValue={requesterEmailDefault ?? ''} required />
              </label>

              <label className="qv-control">
                <span className="qv-label">Your phone</span>
                <input type="tel" name="requester_phone" defaultValue={requesterPhoneDefault ?? ''} />
              </label>
            </>
          )}

          <label className="qv-control">
            <span className="qv-label">Notes</span>
            <textarea name="request_notes" rows={4} placeholder="Add any details that will help us verify your request." />
          </label>

          {state.status !== 'idle' ? (
            <p className={state.status === 'success' ? 'qv-success-text' : 'qv-error-text'}>{state.message}</p>
          ) : null}

          <SubmitButton label={submitLabel} />
        </form>
      </div>
    </section>
  )
}
