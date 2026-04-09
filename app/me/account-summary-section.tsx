'use client';

import { useActionState, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { dismissProfileChangeReviewNoticeAction, submitProfileChangeRequest } from '@/app/me/actions';

type PendingValues = {
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  email: string | null;
  cell_phone: string | null;
  home_phone: string | null;
  email_requested?: boolean;
  cell_phone_requested?: boolean;
  home_phone_requested?: boolean;
} | null;

type RejectedFieldKey = 'email' | 'cell_phone' | 'home_phone';

type RejectedNotices = Partial<
  Record<
    RejectedFieldKey,
    {
      requestId: string;
      reviewedAt: string | null;
    }
  >
>;

type ActionState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

const initialState: ActionState = { status: 'idle', message: '' };

function displayValue(value: string | null) {
  return value && value.trim().length > 0 ? value : 'Not added yet';
}

function pendingDisplayValue(value: string | null, requested?: boolean) {
  if (requested && !value) return 'Clear this value';
  return displayValue(value);
}

function rejectionMessage(label: string) {
  return `${label} edit you submitted was rejected. Please contact your organization to process the change.`;
}

function Row({
  label,
  value,
  pendingValue,
  pendingRequested,
  rejectedNotice,
  onDismissRejected,
  dismissPending,
  editing,
  name,
  onEdit,
  placeholder,
}: {
  label: string;
  value: string | null;
  pendingValue?: string | null;
  pendingRequested?: boolean;
  rejectedNotice?: { reviewedAt: string | null } | null;
  onDismissRejected?: () => void;
  dismissPending?: boolean;
  editing?: boolean;
  name?: string;
  onEdit?: () => void;
  placeholder?: string;
}) {
  const showPending = pendingRequested || (pendingValue !== undefined && pendingValue !== null && pendingValue !== value);
  const showRejected = !showPending && Boolean(rejectedNotice);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'start', padding: '14px 0', borderTop: '1px solid var(--divider)' }}>
      <div style={{ minWidth: 0 }}>
        <div className="qv-detail-label">{label}</div>
        {editing && name ? (
          <input name={name} defaultValue={value ?? ''} placeholder={placeholder} style={{ marginTop: 8 }} />
        ) : (
          <div className="qv-detail-value" style={{ marginTop: 4 }}>{displayValue(value)}</div>
        )}
        {showPending ? <p className="qv-inline-message" style={{ marginTop: 8 }}>Pending review: {pendingDisplayValue(pendingValue ?? null, pendingRequested)}</p> : null}
        {showRejected ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
            <p className="qv-inline-error" style={{ margin: 0 }}>{rejectionMessage(label)}</p>
            {onDismissRejected ? (
              <button type="button" className="qv-button-secondary" onClick={onDismissRejected} disabled={dismissPending}>
                {dismissPending ? 'Dismissing...' : 'Dismiss'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {onEdit ? (
        <button type="button" onClick={onEdit} className="qv-button-secondary" aria-label={`Edit ${label.toLowerCase()}`} style={{ minWidth: 44, paddingInline: 14 }}>
          ✎
        </button>
      ) : null}
    </div>
  );
}

export default function AccountSummarySection({
  officialName,
  firstName,
  lastName,
  preferredName,
  email,
  cellPhone,
  homePhone,
  addressHelpText,
  pendingValues,
  rejectedNotices,
  allowStandaloneIdentityEdit = false,
  readOnly = false,
  readOnlyMessage = null,
}: {
  officialName: string;
  firstName?: string | null;
  lastName?: string | null;
  preferredName: string | null;
  email: string | null;
  cellPhone: string | null;
  homePhone: string | null;
  addressHelpText?: string | null;
  pendingValues: PendingValues;
  rejectedNotices: RejectedNotices;
  allowStandaloneIdentityEdit?: boolean;
  readOnly?: boolean;
  readOnlyMessage?: string | null;
}) {
  const router = useRouter();
  const [state, action, isPending] = useActionState(submitProfileChangeRequest, initialState);
  const [editingFields, setEditingFields] = useState<Record<string, boolean>>({});
  const [isDismissPending, startDismissTransition] = useTransition();

  const isEditing = useMemo(() => Object.values(editingFields).some(Boolean), [editingFields]);

  function enableField(field: string) {
    setEditingFields((current) => ({ ...current, [field]: true }));
  }

  function dismissRejectedNotice(requestId: string) {
    startDismissTransition(async () => {
      const formData = new FormData();
      formData.set('request_id', requestId);
      await dismissProfileChangeReviewNoticeAction(formData);
      router.refresh();
    });
  }

  const content = (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20 }}>
        <div>
          <div className="qv-detail-item" style={{ marginBottom: 16 }}>
            <div className="qv-detail-label">Official record name</div>
            <div className="qv-detail-value">{officialName}</div>
          </div>

          {!readOnly ? (
            <>
              <Row
                label="First name"
                value={firstName ?? null}
                pendingValue={pendingValues?.first_name ?? null}
                editing={!!editingFields.first_name}
                name="first_name"
                placeholder="Your first name"
                onEdit={() => enableField('first_name')}
              />
              <Row
                label="Last name"
                value={lastName ?? null}
                pendingValue={pendingValues?.last_name ?? null}
                editing={!!editingFields.last_name}
                name="last_name"
                placeholder="Your last name"
                onEdit={() => enableField('last_name')}
              />
            </>
          ) : null}

          <Row
            label="Preferred name"
            value={preferredName}
            pendingValue={pendingValues?.preferred_name ?? null}
            editing={!!editingFields.preferred_name}
            name="preferred_name"
            placeholder="How you would like your name to appear"
            onEdit={readOnly ? undefined : () => enableField('preferred_name')}
          />
        </div>

        <div>
          <Row
            label="Email"
            value={email}
            pendingValue={pendingValues?.email ?? null}
            pendingRequested={pendingValues?.email_requested ?? false}
            rejectedNotice={rejectedNotices.email ?? null}
            onDismissRejected={rejectedNotices.email ? () => dismissRejectedNotice(rejectedNotices.email.requestId) : undefined}
            dismissPending={isDismissPending}
            editing={!!editingFields.email}
            name="email"
            placeholder="Your preferred email address"
            onEdit={readOnly ? undefined : () => enableField('email')}
          />
          <Row
            label="Cell phone"
            value={cellPhone}
            pendingValue={pendingValues?.cell_phone ?? null}
            pendingRequested={pendingValues?.cell_phone_requested ?? false}
            rejectedNotice={rejectedNotices.cell_phone ?? null}
            onDismissRejected={rejectedNotices.cell_phone ? () => dismissRejectedNotice(rejectedNotices.cell_phone.requestId) : undefined}
            dismissPending={isDismissPending}
            editing={!!editingFields.cell_phone}
            name="cell_phone"
            placeholder="Your cell phone number"
            onEdit={readOnly ? undefined : () => enableField('cell_phone')}
          />
          <Row
            label="Home phone"
            value={homePhone}
            pendingValue={pendingValues?.home_phone ?? null}
            pendingRequested={pendingValues?.home_phone_requested ?? false}
            rejectedNotice={rejectedNotices.home_phone ?? null}
            onDismissRejected={rejectedNotices.home_phone ? () => dismissRejectedNotice(rejectedNotices.home_phone.requestId) : undefined}
            dismissPending={isDismissPending}
            editing={!!editingFields.home_phone}
            name="home_phone"
            placeholder="Your home phone number"
            onEdit={readOnly ? undefined : () => enableField('home_phone')}
          />
        </div>
      </div>

      {addressHelpText ? (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--divider)' }}>
          <div className="qv-detail-label">Home address</div>
          <div className="qv-detail-value">{addressHelpText}</div>
        </div>
      ) : null}

      {readOnlyMessage ? (
        <p className="qv-inline-message" style={{ marginTop: 14 }}>{readOnlyMessage}</p>
      ) : null}

      {!readOnly && state.status !== 'idle' ? (
        <p className={state.status === 'error' ? 'qv-inline-error' : 'qv-inline-message'} style={{ marginTop: 14 }}>
          {state.message}
        </p>
      ) : null}

      {!readOnly && isEditing ? (
        <div className="qv-form-actions" style={{ marginTop: 18 }}>
          <button type="button" className="qv-button-secondary" onClick={() => setEditingFields({})} disabled={isPending}>Cancel</button>
          <button type="submit" className="qv-button-primary" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      ) : null}
    </>
  );

  return (
    <section className="qv-card">
      <div className="qv-directory-section-head"><div><h2 className="qv-section-title">Account summary</h2></div></div>
      {readOnly ? <div>{content}</div> : <form action={action}>{content}</form>}
    </section>
  );
}
