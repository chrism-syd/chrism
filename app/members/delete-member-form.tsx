'use client';

import { useActionState } from 'react';
import { deleteMemberAction } from './actions';
import { EMPTY_DELETE_MEMBER_STATE } from './form-state';

export default function DeleteMemberForm({ memberId }: { memberId: string }) {
  const [state, formAction] = useActionState(deleteMemberAction, EMPTY_DELETE_MEMBER_STATE);

  return (
    <form action={formAction} className="qv-delete-form qv-form-grid">
      <input type="hidden" name="member_id" value={memberId} />

      <div className="qv-control">
        <label className="qv-label" htmlFor="confirmation">
          Type DELETE to confirm removing this member from the directory
        </label>
        <input id="confirmation" name="confirmation" autoComplete="off" />
      </div>

      {state.error ? (
        <div className="qv-form-alert" role="alert">
          {state.error}
        </div>
      ) : null}

      <div className="qv-form-actions" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
        <button type="submit" className="qv-button-danger qv-link-button">
          Remove member
        </button>
      </div>
    </form>
  );
}
