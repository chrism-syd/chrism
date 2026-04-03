'use client';

import { useState } from 'react';
import FormSubmitButton from '@/app/components/form-submit-button';

type RevokePersonRsvpButtonProps = {
  action: () => Promise<void>;
};

export default function RevokePersonRsvpButton({
  action,
}: RevokePersonRsvpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="qv-button-secondary"
        onClick={() => setOpen(true)}
        style={{
          borderColor: 'var(--danger-600, #b42318)',
          color: 'var(--danger-700, #b42318)',
        }}
      >
        Remove my RSVP
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 60,
            width: 'min(420px, calc(100vw - 32px))',
            border: '1px solid var(--divider)',
            borderRadius: 16,
            background: 'var(--bg-elevated, #fff)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.16)',
            padding: 16,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 18 }}>Remove your RSVP?</h3>

          <p
            style={{
              margin: '8px 0 0',
              fontSize: 14,
              color: 'var(--text-secondary)',
            }}
          >
            This will remove you and any additional people attached to your RSVP from the event.
          </p>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 16,
            }}
          >
            <button
              type="button"
              className="qv-button-secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>

            <form action={action}>
              <FormSubmitButton
                idleLabel="Confirm"
                pendingLabel="Removing…"
                className="qv-button-secondary"
                style={{
                  borderColor: 'var(--danger-600, #b42318)',
                  color: 'var(--danger-700, #b42318)',
                }}
              />
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
