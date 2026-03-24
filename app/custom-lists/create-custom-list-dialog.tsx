'use client'

import { useActionState, useEffect, useState } from 'react'
import { createCustomListFromMembersAction, type CreateCustomListState } from './actions'

const INITIAL_STATE: CreateCustomListState = { error: null }

type Props = {
  open: boolean
  memberIds: string[]
  previewNames: string[]
  onClose: () => void
}

type CreateFormStepProps = {
  memberIds: string[]
  memberCount: number
  onBack: () => void
  onCancel: () => void
}

function CreateCustomListFormStep({ memberIds, memberCount, onBack, onCancel }: CreateFormStepProps) {
  const [state, formAction, isPending] = useActionState(createCustomListFromMembersAction, INITIAL_STATE)

  return (
    <form action={formAction} className="qv-form-grid qv-custom-list-create-form">
      <input type="hidden" name="member_ids" value={JSON.stringify(memberIds)} />
      <div className="qv-directory-section-head">
        <div>
          <p className="qv-inline-message">Step 2 of 2</p>
          <h2 className="qv-section-title">Name this custom list</h2>
          <p className="qv-section-subtitle">
            This will save <strong>{memberCount}</strong> member{memberCount === 1 ? '' : 's'} into a list you can share later.
          </p>
        </div>
      </div>

      <label className="qv-field">
        <span>Name</span>
        <input
          name="name"
          type="text"
          placeholder="Home visits, Prospects spring outreach, Christmas calls..."
          maxLength={120}
          required
        />
      </label>

      <label className="qv-field">
        <span>Description</span>
        <textarea name="description" rows={3} placeholder="Optional note about what this list is for." />
      </label>

      {state.error ? <p className="qv-inline-error">{state.error}</p> : null}

      <div className="qv-form-actions">
        <button type="button" className="qv-button-secondary" onClick={onCancel} disabled={isPending}>
          Cancel
        </button>
        <button type="button" className="qv-button-secondary" onClick={onBack} disabled={isPending}>
          Back
        </button>
        <button type="submit" className="qv-button-primary" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save custom list'}
        </button>
      </div>
    </form>
  )
}

export default function CreateCustomListDialog({ open, memberIds, previewNames, onClose }: Props) {
  const [step, setStep] = useState<'review' | 'details'>('review')

  useEffect(() => {
    if (!open) return undefined

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose, open])

  if (!open || memberIds.length === 0) {
    return null
  }

  return (
    <div className="qv-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="qv-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-custom-list-title"
        onClick={(event) => event.stopPropagation()}
      >
        {step === 'review' ? (
          <div className="qv-custom-list-review">
            <div className="qv-directory-section-head">
              <div>
                <p className="qv-inline-message">Step 1 of 2</p>
                <h2 id="create-custom-list-title" className="qv-section-title">Review this list</h2>
                <p className="qv-section-subtitle">
                  The custom list will include <strong>{memberIds.length}</strong> member{memberIds.length === 1 ? '' : 's'} from the current filtered view.
                </p>
              </div>
            </div>

            <div className="qv-custom-list-review-box">
              <div className="qv-detail-badges">
                <span className="qv-badge">{memberIds.length} selected</span>
                <span className="qv-badge qv-badge-soft">Current filters applied</span>
              </div>
              <div className="qv-custom-list-preview-grid">
                {previewNames.map((name) => (
                  <span key={name} className="qv-badge qv-badge-soft">
                    {name}
                  </span>
                ))}
                {memberIds.length > previewNames.length ? (
                  <span className="qv-badge qv-badge-soft">+{memberIds.length - previewNames.length} more</span>
                ) : null}
              </div>
            </div>

            <div className="qv-form-actions">
              <button type="button" className="qv-button-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="qv-button-primary" onClick={() => setStep('details')}>
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === 'details' ? (
          <CreateCustomListFormStep
            key="details"
            memberIds={memberIds}
            memberCount={memberIds.length}
            onBack={() => setStep('review')}
            onCancel={onClose}
          />
        ) : null}
      </div>
    </div>
  )
}
