import ConfirmActionButton from '@/app/components/confirm-action-button';
import { addOfficerTermAction, deleteOfficerTermAction } from '@/app/members/officer-actions';
import {
  OFFICER_ROLE_GROUPS,
  buildOfficerDisplayLabel,
  isOfficerTermCurrent,
  summarizeHonorificSuffixes,
  summarizeLastingHonorifics,
  type OfficerTermRow,
} from '@/lib/members/officer-roles';

type PersonSummary = {
  id: string;
  first_name: string;
  last_name: string;
};

type MemberOfficerServiceSectionProps = {
  person: PersonSummary;
  terms: OfficerTermRow[];
  compact?: boolean;
  returnTo: string;
  noticeMessage?: string | null;
  errorMessage?: string | null;
};

function currentYear() {
  return new Date().getFullYear();
}

function serviceYearsLabel(term: OfficerTermRow) {
  return term.service_end_year == null
    ? `${term.service_start_year} to present`
    : `${term.service_start_year} to ${term.service_end_year}`;
}

export default function MemberOfficerServiceSection({
  person,
  terms,
  compact = false,
  returnTo,
  noticeMessage,
  errorMessage,
}: MemberOfficerServiceSectionProps) {
  const yearNow = currentYear();
  const honorificLabels = summarizeLastingHonorifics(terms);
  const honorificSuffixes = summarizeHonorificSuffixes(terms);

  return (
    <section className="qv-card">
      <div className="qv-directory-section-head">
        <div>
          <h2 className="qv-section-title">Officer service</h2>
          <p className="qv-section-subtitle">
            Add or remove service terms for {person.first_name} {person.last_name}. Enduring honorifics such as{' '}
            PGK are applied automatically from completed terms.
          </p>
        </div>
      </div>

      {noticeMessage ? (
        <section className="qv-card" style={{ borderColor: 'var(--divider-strong)', marginBottom: 18 }}>
          <p style={{ margin: 0, color: 'var(--text-primary)' }}>{noticeMessage}</p>
        </section>
      ) : null}

      {errorMessage ? (
        <section className="qv-card qv-error" style={{ marginBottom: 18 }}>
          <p style={{ margin: 0 }}>{errorMessage}</p>
        </section>
      ) : null}

      {honorificLabels.length > 0 ? (
        <div className="qv-detail-badges" style={{ marginBottom: 18 }}>
          {honorificLabels.map((label, index) => (
            <span key={`${label}-${index}`} className="qv-badge qv-badge-soft">
              {label}
              {honorificSuffixes[index] ? ` (${honorificSuffixes[index]})` : ''}
            </span>
          ))}
        </div>
      ) : null}

      <form action={addOfficerTermAction} className="qv-form-grid">
        <input type="hidden" name="person_id" value={person.id} />
        <input type="hidden" name="return_to" value={returnTo} />

        <div className="qv-form-row">
          <label className="qv-control">
            <span className="qv-label">Officer role</span>
            <select name="role_key" required defaultValue="">
              <option value="" disabled>
                Select a role
              </option>
              {OFFICER_ROLE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((option) => (
                    <option key={`${option.scope}:${option.code}`} value={`${option.scope}:${option.code}`}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        <div className="qv-form-row qv-form-row-3">
          <label className="qv-control">
            <span className="qv-label">Start year</span>
            <input name="service_start_year" type="number" min="1900" max="2100" defaultValue={yearNow} required />
          </label>

          <label className="qv-control">
            <span className="qv-label">End year</span>
            <input name="service_end_year" type="number" min="1900" max="2100" placeholder="Leave blank if current" />
          </label>

          <label className="qv-control">
            <span className="qv-label">Trustee rank</span>
            <input name="office_rank" type="number" min="1" max="3" placeholder="Only for trustees" />
          </label>
        </div>

        <div className="qv-form-row">
          <label className="qv-control">
            <span className="qv-label">Notes</span>
            <textarea name="notes" placeholder="Optional context, such as acting term, special appointment, or district details." />
          </label>
        </div>

        <div className="qv-form-actions">
          <button type="submit" className="qv-button-primary">
            Save officer term
          </button>
        </div>
      </form>

      {terms.length === 0 ? (
        <div className="qv-empty" style={{ marginTop: 18 }}>
          <p className="qv-empty-title">No officer terms yet</p>
          <p className="qv-empty-text">
            Add the first service term here. When offices change in a future year, end the current term and add the next one.
          </p>
        </div>
      ) : (
        <div className="qv-member-list" style={{ marginTop: 18 }}>
          {terms.map((term) => (
            <article key={term.id} className="qv-member-row">
              <div className="qv-member-text">
                <div className="qv-member-name">{buildOfficerDisplayLabel(term)}</div>
                <div className="qv-member-meta">{serviceYearsLabel(term)}</div>
                {term.notes ? <div className="qv-member-meta">{term.notes}</div> : null}
              </div>

              <div className="qv-member-row-right">
                {isOfficerTermCurrent(term, yearNow) ? <span className="qv-badge">Current</span> : null}
                <ConfirmActionButton
                  triggerLabel="Remove"
                  confirmTitle="Remove officer term?"
                  confirmDescription={`This will permanently remove ${buildOfficerDisplayLabel(term)} (${serviceYearsLabel(term)}) from ${person.first_name} ${person.last_name}'s service history.`}
                  confirmLabel="Remove term"
                  danger
                  action={deleteOfficerTermAction}
                  hiddenFields={[
                    { name: 'person_id', value: person.id },
                    { name: 'term_id', value: term.id },
                    { name: 'return_to', value: returnTo },
                  ]}
                />
              </div>
            </article>
          ))}
        </div>
      )}

      {!compact ? null : (
        <p className="qv-inline-message" style={{ marginTop: 14 }}>
          Officer history stays with the member profile, so year-to-year changes can be recorded cleanly instead of overwriting the past.
        </p>
      )}
    </section>
  );
}
