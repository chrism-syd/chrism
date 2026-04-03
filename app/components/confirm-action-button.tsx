'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import FormSubmitButton from '@/app/components/form-submit-button';

type HiddenField = {
  name: string;
  value: string;
};

type BaseProps = {
  triggerLabel: ReactNode;
  confirmTitle: string;
  confirmDescription: string;
  confirmLabel?: string;
  cancelLabel?: string;
  triggerClassName?: string;
  confirmClassName?: string;
  triggerStyle?: CSSProperties;
  confirmStyle?: CSSProperties;
  danger?: boolean;
  disabled?: boolean;
};

type ConfirmFormActionProps = BaseProps & {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields?: HiddenField[];
  onConfirm?: never;
};

type ConfirmCallbackProps = BaseProps & {
  onConfirm: () => void | Promise<void>;
  action?: never;
  hiddenFields?: never;
};

type ConfirmActionButtonProps = ConfirmFormActionProps | ConfirmCallbackProps;

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

function cardStyle(): CSSProperties {
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

function textStyle(): CSSProperties {
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

export default function ConfirmActionButton(props: ConfirmActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const confirmLabel = props.confirmLabel ?? 'Confirm';
  const cancelLabel = props.cancelLabel ?? 'Cancel';
  const triggerClassName = props.triggerClassName ?? 'qv-button-secondary';
  const confirmClassName = props.confirmClassName ?? 'qv-button-secondary';
  const toneStyle = props.danger ? dangerButtonStyle() : undefined;

  const onConfirm = 'onConfirm' in props ? props.onConfirm : null;

  async function handleConfirmClick() {
    if (!onConfirm) {
      return;
    }

    try {
      setIsConfirming(true);
      await onConfirm();
      setIsOpen(false);
    } finally {
      setIsConfirming(false);
    }
  }

  const isFormActionVariant = 'action' in props;
  const formAction = isFormActionVariant ? props.action : undefined;
  const hiddenFields = isFormActionVariant ? props.hiddenFields ?? [] : [];

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        style={{ ...(toneStyle ?? {}), ...(props.triggerStyle ?? {}) }}
        onClick={() => setIsOpen(true)}
        disabled={props.disabled}
      >
        {props.triggerLabel}
      </button>

      {isOpen ? (
        <div style={overlayStyle()} role="dialog" aria-modal="true" aria-labelledby="confirm-action-title">
          <div style={cardStyle()}>
            <h3 id="confirm-action-title" className="qv-section-title">
              {props.confirmTitle}
            </h3>

            <p style={textStyle()}>{props.confirmDescription}</p>

            <div style={actionsRowStyle()}>
              <button
                type="button"
                className="qv-button-secondary"
                onClick={() => setIsOpen(false)}
                disabled={isConfirming}
              >
                {cancelLabel}
              </button>

              {formAction ? (
                <form action={formAction}>
                  {hiddenFields.map((field) => (
                    <input key={`${field.name}:${field.value}`} type="hidden" name={field.name} value={field.value} />
                  ))}
                  <FormSubmitButton
                    idleLabel={confirmLabel}
                    pendingLabel="Working…"
                    className={confirmClassName}
                    style={{ ...(toneStyle ?? {}), ...(props.confirmStyle ?? {}) }}
                  />
                </form>
              ) : (
                <button
                  type="button"
                  className={confirmClassName}
                  style={{ ...(toneStyle ?? {}), ...(props.confirmStyle ?? {}) }}
                  onClick={handleConfirmClick}
                  disabled={isConfirming}
                >
                  {isConfirming ? 'Working…' : confirmLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
