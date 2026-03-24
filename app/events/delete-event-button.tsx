'use client';

import { useState, type CSSProperties } from 'react';

type DeleteEventButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
};

function overlayStyle(): CSSProperties {
  return {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1000,
  };
}

function toastCardStyle(): CSSProperties {
  return {
    width: '100%',
    maxWidth: 460,
    borderRadius: 20,
    border: '1px solid var(--divider)',
    background: 'var(--bg-elevated, #fff)',
    boxShadow: '0 18px 48px rgba(15, 23, 42, 0.18)',
    padding: 20,
  };
}

function toastTextStyle(): CSSProperties {
  return {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--text-secondary)',
  };
}

function actionsRowStyle(): CSSProperties {
  return {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
    flexWrap: 'wrap',
  };
}

function dangerButtonStyle(): CSSProperties {
  return {
    borderColor: 'var(--danger-600, #b42318)',
    color: 'var(--danger-700, #b42318)',
  };
}

export default function DeleteEventButton({ action }: DeleteEventButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="qv-button-secondary"
        style={dangerButtonStyle()}
        onClick={() => setIsOpen(true)}
      >
        Archive event
      </button>

      {isOpen ? (
        <div
          style={overlayStyle()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-event-title"
        >
          <div style={toastCardStyle()}>
            <h3 id="delete-event-title" className="qv-section-title">
              Archive event?
            </h3>

            <p style={toastTextStyle()}>
              This will move the event into the admin archive and remove it from the active events list. RSVP responses, invited groups, volunteer records, and message jobs will be removed from the live event.
            </p>

            <div style={actionsRowStyle()}>
              <button
                type="button"
                className="qv-button-secondary"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </button>

              <button
                type="submit"
                formAction={action}
                className="qv-button-secondary"
                style={dangerButtonStyle()}
              >
                Confirm archive
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}