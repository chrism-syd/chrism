'use client';

import { useState } from 'react';

type RemoveVolunteerButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
  warningText?: string;
  confirmLabel?: string;
};

export default function RemoveVolunteerButton({
  action,
  warningText = 'This will remove this volunteer from the event roster.',
  confirmLabel = 'Confirm remove',
}: RemoveVolunteerButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="qv-button-danger" onClick={() => setOpen(true)}>
        Remove volunteer
      </button>

      {open ? (
        <div role="dialog" aria-modal="true" className="qv-floating-dialog">
          <div className="qv-floating-dialog-panel">
            <div className="qv-floating-dialog-copy">
              <h3 className="qv-section-title" style={{ margin: 0 }}>
                Remove volunteer?
              </h3>
              <p className="qv-inline-message" style={{ margin: 0 }}>
                {warningText}
              </p>
            </div>

            <div className="qv-form-actions qv-floating-dialog-actions">
              <button type="button" className="qv-button-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>

              <form action={action}>
                <button type="submit" className="qv-button-danger">
                  {confirmLabel}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
