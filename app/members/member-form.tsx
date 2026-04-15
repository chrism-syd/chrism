'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createMemberAction, updateMemberAction } from './actions';
import { EMPTY_MEMBER_FORM_STATE, type MemberFormValues, type PersonRelationshipCode } from './form-state';

function SubmitButton({ label }: { label: string }) {
  return (
    <button type="submit" className="qv-button-primary">
      {label}
    </button>
  );
}

const RELATIONSHIP_OPTIONS: Array<{ value: PersonRelationshipCode; label: string; description: string }> = [
  {
    value: 'member',
    label: 'Member',
    description: 'For active or future rostered members.',
  },
  {
    value: 'volunteer_only',
    label: 'Volunteer',
    description: 'For people who help but are not members.',
  },
  {
    value: 'prospect',
    label: 'Prospect',
    description: 'For people still being invited or followed up with.',
  },
];

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

      <div className="qv-form-row">
        <fieldset
          className="qv-control"
          style={{
            margin: 0,
            padding: 0,
            border: 'none',
            minInlineSize: 0,
          }}
        >
          <legend className="qv-label" style={{ marginBottom: 10 }}>
            Type
          </legend>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {RELATIONSHIP_OPTIONS.map((option) => {
              const isSelected = values.primary_relationship_code === option.value;

              return (
                <label
                  key={option.value}
                  style={{
                    display: 'grid',
                    gap: 6,
                    borderRadius: 16,
                    border: isSelected ? '1px solid var(--interactive)' : '1px solid var(--divider-strong)',
                    background: isSelected ? 'var(--bg-card)' : 'var(--bg-subtle)',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 0 1px rgba(92, 74, 114, 0.12)' : 'none',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="radio"
                      name="primary_relationship_code"
                      value={option.value}
                      defaultChecked={values.primary_relationship_code === option.value}
                      style={{ width: 16, height: 16, margin: 0 }}
                    />
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{option.label}</span>
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.35, color: 'var(--text-secondary)' }}>
                    {option.description}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

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
        Add at least one contact method. Imported Supreme roster rows can stay contact-light, but manual entries cannot
        save completely blank contact info.
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
        <SubmitButton label="Save person" />
      </div>
    </form>
  );
}
