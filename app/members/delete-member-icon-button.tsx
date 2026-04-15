'use client'

import { useActionState, useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { deleteMemberAction } from './actions'
import { EMPTY_DELETE_MEMBER_STATE } from './form-state'

function overlayStyle(): CSSProperties {
  return {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.56)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 4000,
  }
}

function cardStyle(): CSSProperties {
  return {
    width: '100%',
    maxWidth: 460,
    borderRadius: 20,
    border: '1px solid var(--divider)',
    background: 'var(--bg-elevated, #fff)',
    boxShadow: '0 18px 48px rgba(15, 23, 42, 0.18)',
    padding: 20,
  }
}

function textStyle(): CSSProperties {
  return {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  }
}

function actionsRowStyle(): CSSProperties {
  return {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
    flexWrap: 'wrap',
  }
}

function BootstrapTrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0A.5.5 0 0 1 8.5 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
      <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1 0-2H5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1h2.5a1 1 0 0 1 1 1M6 2a.5.5 0 0 0-.5.5V3h5v-.5A.5.5 0 0 0 10 2zm-2 2v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4z" />
    </svg>
  )
}

export default function DeleteMemberIconButton({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [state, formAction] = useActionState(deleteMemberAction, EMPTY_DELETE_MEMBER_STATE)

  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  const dialog = isOpen ? (
    <div style={overlayStyle()} role="dialog" aria-modal="true" aria-labelledby="delete-member-title">
      <div style={cardStyle()}>
        <h3 id="delete-member-title" className="qv-section-title">
          Remove {memberName}?
        </h3>

        <p style={textStyle()}>
          This removes the person from the active directory. Type DELETE to confirm.
        </p>

        <form action={formAction} className="qv-delete-form qv-form-grid" style={{ marginTop: 18 }}>
          <input type="hidden" name="member_id" value={memberId} />

          <div className="qv-control">
            <label className="qv-label" htmlFor="member-delete-confirmation">
              Type DELETE to confirm removing this person from the directory
            </label>
            <input id="member-delete-confirmation" name="confirmation" autoComplete="off" />
          </div>

          {state.error ? (
            <div className="qv-form-alert" role="alert">
              {state.error}
            </div>
          ) : null}

          <div style={actionsRowStyle()}>
            <button type="button" className="qv-button-secondary" onClick={() => setIsOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="qv-button-danger qv-link-button">
              Remove person
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null

  return (
    <>
      <button
        type="button"
        className="qv-icon-button qv-icon-button-danger"
        onClick={() => setIsOpen(true)}
        aria-label={`Remove ${memberName}`}
      >
        <BootstrapTrashIcon className="qv-bi-icon" />
      </button>

      {isMounted && dialog ? createPortal(dialog, document.body) : null}
    </>
  )
}
