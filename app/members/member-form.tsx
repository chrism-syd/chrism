'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createMemberAction, updateMemberAction } from './actions';
import { EMPTY_MEMBER_FORM_STATE, type MemberFormValues } from './form-state';

function SubmitButton({ label }: { label: string }) {
  return (
    <button type="submit" className="qv-button-primary">
      {label}
    </button>
  );
}

type MemberFormProps = {
  mode: 'create' | 'edit';
  initialValues: Partial<MemberFormValues>;
  cancelHref: string;
};

export default function MemberForm({ mode, initialValues, cancelHref }: MemberFormProps) {
  const action = mode === 'create' ? createMemberAction : updateMemberAction;
  const [state, formAction] = useActionState(action, {
    ...EMPTY_MEMBER_FORM_STATE,
    values: {
      ...EMPTY_MEMBER_FORM_STATE.values,
      ...initialValues,
    },
  });

  const values = state.values;

  return (
    <form action={formAction} className="qv-form-grid">
      {mode === 'edit' ? <input type="hidden" name="member_id" value={values.member_id ?? ''} /> : null}

      {state.error ? (
        <div className="qv-form-alert" role="alert">
          {state.error}
        </div>
      ) : null}

      <div className="qv-form-row qv-form-row-3">
        <div className="qv-control">
          <label className="qv-label" htmlFor="first_name">
            First name
          </label>
          <input id="first_name" name="first_name" defaultValue={values.first_name ?? ''} required />
        </div>
        <div className="qv-control">
          <label className="qv-label" htmlFor="middle_name">
            Middle name
          </label>
          <input id="middle_name" name="middle_name" defaultValue={values.middle_name ?? ''} />
        </div>
        <div className="qv-control">
          <label className="qv-label" htmlFor="last_name">
            Last name
          </label>
          <input id="last_name" name="last_name" defaultValue={values.last_name ?? ''} required />
        </div>
      </div>

      <div className="qv-form-row qv-form-row-2">
        <div className="qv-control">
          <label className="qv-label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" defaultValue={values.email ?? ''} />
        </div>
        <div className="qv-control">
          <label className="qv-label" htmlFor="cell_phone">
            Cell phone
          </label>
          <input id="cell_phone" name="cell_phone" defaultValue={values.cell_phone ?? ''} />
        </div>
      </div>

      <div className="qv-form-row qv-form-row-2">
        <div className="qv-control">
          <label className="qv-label" htmlFor="home_phone">
            Home phone
          </label>
          <input id="home_phone" name="home_phone" defaultValue={values.home_phone ?? ''} />
        </div>
        <div className="qv-control">
          <label className="qv-label" htmlFor="other_phone">
            Other phone
          </label>
          <input id="other_phone" name="other_phone" defaultValue={values.other_phone ?? ''} />
        </div>
      </div>

      <p className="qv-field-hint">
        Add at least one contact method. Imported Supreme roster rows can stay contact-light, but manual member edits cannot save completely blank contact info.
      </p>

      <div className="qv-form-row">
        <div className="qv-control">
          <label className="qv-label" htmlFor="address_line_1">
            Address line 1
          </label>
          <input id="address_line_1" name="address_line_1" defaultValue={values.address_line_1 ?? ''} />
        </div>
      </div>

      <div className="qv-form-row">
        <div className="qv-control">
          <label className="qv-label" htmlFor="address_line_2">
            Address line 2
          </label>
          <input id="address_line_2" name="address_line_2" defaultValue={values.address_line_2 ?? ''} />
        </div>
      </div>

      <div className="qv-form-row qv-form-row-3">
        <div className="qv-control">
          <label className="qv-label" htmlFor="city">
            City
          </label>
          <input id="city" name="city" defaultValue={values.city ?? ''} />
        </div>
        <div className="qv-control">
          <label className="qv-label" htmlFor="state_province">
            State / Province
          </label>
          <input id="state_province" name="state_province" defaultValue={values.state_province ?? ''} />
        </div>
        <div className="qv-control">
          <label className="qv-label" htmlFor="postal_code">
            Postal code
          </label>
          <input id="postal_code" name="postal_code" defaultValue={values.postal_code ?? ''} />
        </div>
      </div>

      <div className="qv-form-row qv-form-row-3">
        <div className="qv-control">
          <label className="qv-label" htmlFor="council_activity_level_code">
            Activity level
          </label>
          <select
            id="council_activity_level_code"
            name="council_activity_level_code"
            defaultValue={values.council_activity_level_code ?? ''}
          >
            <option value="">Leave blank for now</option>
            <option value="active">Active</option>
            <option value="occasional">Occasional</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="qv-control">
          <label className="qv-label" htmlFor="council_activity_context_code">
            Activity context
          </label>
          <select
            id="council_activity_context_code"
            name="council_activity_context_code"
            defaultValue={values.council_activity_context_code ?? ''}
          >
            <option value="">Leave blank for now</option>
            <option value="none">None</option>
            <option value="senior_limited">Senior limited</option>
            <option value="health_limited">Health limited</option>
            <option value="transportation_limited">Transportation limited</option>
            <option value="family_caregiving">Family caregiving</option>
            <option value="disengaged">Disengaged</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>

        <div className="qv-control">
          <label className="qv-label" htmlFor="council_reengagement_status_code">
            Re-engagement
          </label>
          <select
            id="council_reengagement_status_code"
            name="council_reengagement_status_code"
            defaultValue={values.council_reengagement_status_code ?? ''}
          >
            <option value="">Leave blank for now</option>
            <option value="none">None</option>
            <option value="monitoring">Monitoring</option>
            <option value="hardship_support">Hardship support</option>
            <option value="reengagement_in_progress">Re-engagement in progress</option>
            <option value="disengaged_no_response">Disengaged, no response</option>
          </select>
        </div>
      </div>

      <div className="qv-form-actions">
        <Link href={cancelHref} className="qv-button-secondary qv-link-button">
          Cancel
        </Link>
        <SubmitButton label={mode === 'create' ? 'Save member' : 'Save member'} />
      </div>
    </form>
  );
}
