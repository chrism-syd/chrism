'use client'

import { useActionState, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import type { CouncilClaimLookupOption } from '@/lib/organizations/claim-requests'
import type { ClaimOrganizationActionState } from '@/app/me/claim-organization/actions'
import { initialClaimOrganizationActionState } from '@/app/me/claim-organization/actions'

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
              placeholder="e.g. Toronto Council"
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
              placeholder="GTA only for now"
            />
          </label>
        </div>

        {showResults ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              {filteredOptions.slice(0, 10).map((option) => (
                <button
                  key={option.councilId}
                  type="button"
                  className="qv-link-button qv-button-secondary"
                  style={{ justifyContent: 'space-between', textAlign: 'left', width: '100%' }}
                  onClick={() => chooseCouncil(option)}
                >
                  <span><strong>{option.councilName}</strong> ({option.councilNumber})</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{option.city ?? 'GTA'}</span>
                </button>
              ))}
              {filteredOptions.length === 0 ? <div className="qv-inline-message">No listed councils matched those filters.</div> : null}
            </div>

            <button type="button" className="qv-link-button qv-button-secondary" onClick={enableRequestAccessMode}>
              Council not listed? Request Access
            </button>
          </div>
        ) : null}

        <form action={formAction} style={{ display: 'grid', gap: 14 }}>
          <input type="hidden" name="selected_council_id" value={selectedCouncil?.councilId ?? ''} />
          <input type="hidden" name="selected_organization_id" value={selectedCouncil?.organizationId ?? ''} />

          {showSelectedSummary ? (
            <div className="qv-card" style={{ background: 'var(--bg-sunken)', gap: 10, display: 'grid' }}>
              <div>
                <div className="qv-eyebrow">Selected council</div>
                <div style={{ fontWeight: 700 }}>{selectedCouncil?.councilName} ({selectedCouncil?.councilNumber})</div>
                <div style={{ color: 'var(--text-secondary)' }}>{selectedCouncil?.city ?? 'GTA'}</div>
                {selectedCouncil && selectedCouncil.parishAssociations.length > 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                    Parishes: {selectedCouncil.parishAssociations.join(', ')}
                  </div>
                ) : null}
              </div>
              <button type="button" className="qv-link-button" onClick={() => setSelectedCouncilId(null)}>
                Choose a different council
              </button>
            </div>
          ) : null}

          {showManualFields ? (
            <div className="qv-card" style={{ background: 'var(--bg-sunken)', display: 'grid', gap: 14 }}>
              <div className="qv-inline-message">
                We will queue this request for manual review. Fill in the council details as best you can.
              </div>
              <div className="qv-form-row" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                <label className="qv-control">
                  <span className="qv-label">Council name</span>
                  <input name="requested_council_name" defaultValue={councilNameQuery} required />
                </label>
                <label className="qv-control">
                  <span className="qv-label">Council number</span>
                  <input name="requested_council_number" defaultValue={councilNumberQuery} />
                </label>
                <label className="qv-control">
                  <span className="qv-label">City</span>
                  <input name="requested_city" defaultValue={cityQuery} required />
                </label>
              </div>
            </div>
          ) : null}

          {audience === 'public' ? (
            <div className="qv-form-row" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              <label className="qv-control">
                <span className="qv-label">Your name</span>
                <input name="requester_name" defaultValue={requesterNameDefault ?? ''} required />
              </label>
              <label className="qv-control">
                <span className="qv-label">Email</span>
                <input type="email" name="requester_email" defaultValue={requesterEmailDefault ?? ''} required />
              </label>
              <label className="qv-control">
                <span className="qv-label">Phone (optional)</span>
                <input name="requester_phone" defaultValue={requesterPhoneDefault ?? ''} />
              </label>
            </div>
          ) : (
            <label className="qv-control">
              <span className="qv-label">Your name</span>
              <input name="requester_name" defaultValue={requesterNameDefault ?? ''} placeholder="Your name for the reviewer" />
            </label>
          )}

          <label className="qv-control">
            <span className="qv-label">Notes {audience === 'public' ? '(optional)' : '(helps with review)'}</span>
            <textarea name="request_notes" rows={4} placeholder="Tell us what role you hold or why you need access." />
          </label>

          {state.status !== 'idle' ? (
            <p className={state.status === 'error' ? 'qv-inline-error' : 'qv-inline-message'} style={{ margin: 0 }}>
              {state.message}
            </p>
          ) : null}

          {(showSelectedSummary || showManualFields) ? (
            <div className="qv-form-actions">
              <SubmitButton label={submitLabel} />
            </div>
          ) : null}
        </form>
      </div>
    </section>
  )
}
