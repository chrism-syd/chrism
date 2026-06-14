import Link from 'next/link'
import FormSubmitButton from '@/app/components/form-submit-button'
import AdminInvitePhraseHandoff from './admin-invite-phrase-handoff'
import { inviteCouncilAdminByEmailAction } from './actions'

export default function ExternalAdminInviteForm() {
  return (
    <form action={inviteCouncilAdminByEmailAction} className="qv-form-grid">
      <AdminInvitePhraseHandoff />
      <div>
        <h2 className="qv-section-title" style={{ fontSize: 20 }}>External invite by email</h2>
        <p className="qv-section-subtitle">
          Invite someone who is not already in the directory. They will need both their email code and the shared verification phrase to accept access.
        </p>
      </div>
      <label className="qv-control">
        <span className="qv-label">Invitee name</span>
        <input name="invitee_name" placeholder="e.g. John Smith" required />
      </label>
      <label className="qv-control">
        <span className="qv-label">Invitee email</span>
        <input name="grantee_email" type="email" placeholder="future-admin@example.org" required />
      </label>
      <label className="qv-control">
        <span className="qv-label">Shared verification phrase</span>
        <input
          name="shared_verification_phrase"
          type="text"
          minLength={4}
          placeholder="Phrase you will share with the invitee separately"
          required
        />
      </label>
      <label className="qv-control">
        <span className="qv-label">Notes</span>
        <textarea name="grant_notes" placeholder="Optional handoff or takeover notes." rows={5} />
      </label>
      <label
        style={{
          alignItems: 'flex-start',
          display: 'flex',
          gap: 10,
          color: 'var(--text-secondary)',
          fontSize: 14,
          fontWeight: 650,
          lineHeight: 1.45,
        }}
      >
        <input
          name="confirm_sensitive_admin_invite"
          type="checkbox"
          value="true"
          required
          style={{ marginTop: 2, width: 'auto' }}
        />
        <span>
          I confirm the invitee name and email are correct, and I understand this person will be able to access sensitive member and organization information.
        </span>
      </label>
      <div className="qv-form-actions">
        <FormSubmitButton
          idleLabel="Send invite"
          pendingLabel="Sending invite..."
          className="qv-button-primary"
        />
        <Link href="/me/council" className="qv-link-button">Cancel</Link>
      </div>
    </form>
  )
}
