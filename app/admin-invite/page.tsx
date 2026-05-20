import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { getOrganizationAdminInvitationByRawToken } from '@/lib/organizations/admin-invitations'
import { acceptAdminInvitationAction } from './actions'
import InviteSignInForm from './invite-sign-in-form'
import SwitchAccountButton from './switch-account-button'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function formatStatus(invitation: { isExpired: boolean; status_code: string }) {
  if (invitation.isExpired) return 'Expired'
  return invitation.status_code.charAt(0).toUpperCase() + invitation.status_code.slice(1)
}

export default async function AdminInvitePage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const token = typeof resolvedSearchParams.token === 'string' ? resolvedSearchParams.token : null
  const errorMessage = typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : null
  const noticeMessage = typeof resolvedSearchParams.notice === 'string' ? resolvedSearchParams.notice : null

  if (!token) {
    redirect('/admin-invite/invalid?reason=missing')
  }

  const invitation = await getOrganizationAdminInvitationByRawToken(token)

  if (!invitation) {
    redirect(`/admin-invite/invalid?reason=missing&token=${encodeURIComponent(token)}`)
  }
  const permissions = await getCurrentUserPermissions()
  const signedInEmail = permissions.email?.trim().toLowerCase() ?? null
  const invitePath = `/admin-invite?token=${token}`
  const councilLabel = [invitation.councilName, invitation.councilNumber ? `Council ${invitation.councilNumber}` : null]
    .filter(Boolean)
    .join(' · ')
  const orgLabel = invitation.organizationName || 'this organization'

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <section style={{ display: 'grid', gap: 14, paddingTop: 28, marginBottom: 18 }}>
          <Image
            src="/Chrism-ops.svg"
            alt="Chrism"
            width={220}
            height={74}
            priority
            style={{ width: 220, height: 'auto' }}
          />
          <h1 className="qv-directory-name" style={{ margin: 0, fontSize: 'clamp(42px, 6.4vw, 72px)', lineHeight: 0.94 }}>
            Accept admin access
          </h1>
          <p style={{ margin: 0, maxWidth: '52ch', fontSize: 15, fontWeight: 700, lineHeight: 1.4, color: 'var(--text-secondary)' }}>
            This invite grants admin access to an existing local organization in Chrism. Review the details before continuing.
          </p>
        </section>

        {errorMessage ? <p className="qv-inline-message qv-inline-error">{errorMessage}</p> : null}
        {noticeMessage ? <p className="qv-inline-message qv-inline-success">{noticeMessage}</p> : null}

        <section className="qv-hero-card">
          <div className="qv-hero-top">
            <div style={{ display: 'grid', gap: 10 }}>
              <p className="qv-eyebrow" style={{ margin: 0 }}>You were invited to manage</p>
              <h2 className="qv-section-title" style={{ margin: 0 }}>{orgLabel}</h2>
              {councilLabel ? (
                <p className="qv-section-subtitle" style={{ margin: 0 }}>{councilLabel}</p>
              ) : null}
            </div>
          </div>

          <div className="qv-detail-grid" style={{ marginTop: 18 }}>
            <div className="qv-card" style={{ margin: 0 }}>
              <h3 className="qv-section-title" style={{ fontSize: 24 }}>Invite details</h3>
              <div className="qv-detail-list" style={{ marginTop: 12 }}>
                <div className="qv-detail-item" style={{ paddingTop: 0 }}>
                  <div className="qv-detail-label">Invited email</div>
                  <div className="qv-detail-value">{invitation.invitee_email}</div>
                </div>
                {invitation.invitee_name ? (
                  <div className="qv-detail-item">
                    <div className="qv-detail-label">Invited name</div>
                    <div className="qv-detail-value">{invitation.invitee_name}</div>
                  </div>
                ) : null}
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Invite status</div>
                  <div className="qv-detail-value">{formatStatus(invitation)}</div>
                </div>
                {permissions.email ? (
                  <div className="qv-detail-item">
                    <div className="qv-detail-label">Signed in as</div>
                    <div className="qv-detail-value">{permissions.email}</div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="qv-card" style={{ margin: 0 }}>
              <h3 className="qv-section-title" style={{ fontSize: 24 }}>What happens next</h3>
              <div className="qv-detail-list" style={{ marginTop: 12 }}>
                <div className="qv-detail-item" style={{ paddingTop: 0 }}>
                  <div className="qv-detail-label">Access</div>
                  <div className="qv-detail-value">You will be added as an organization admin for this local org.</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Dashboard</div>
                  <div className="qv-detail-value">After accepting, Chrism will take you to the organization settings area.</div>
                </div>
                <div className="qv-detail-item">
                  <div className="qv-detail-label">Security</div>
                  <div className="qv-detail-value">This invite only works for the invited email address.</div>
                </div>
              </div>
            </div>
          </div>

          {invitation.notes ? (
            <div className="qv-card" style={{ marginTop: 18 }}>
              <div className="qv-detail-label">Onboarding notes</div>
              <div className="qv-detail-value" style={{ marginTop: 6 }}>{invitation.notes}</div>
            </div>
          ) : null}

          <div style={{ marginTop: 22 }}>
            {!permissions.authUser ? (
              <InviteSignInForm inviteeEmail={invitation.invitee_email} invitePath={invitePath} />
            ) : invitation.status_code !== 'pending' || invitation.isExpired ? (
              <p className="qv-inline-message">
                This invite can no longer be accepted. Ask a current admin to send a fresh one.
              </p>
            ) : signedInEmail !== invitation.invitee_email ? (
              <div className="qv-inline-message qv-inline-error" style={{ display: 'grid', gap: 12, justifyItems: 'start' }}>
                <p style={{ margin: 0 }}>
                  You are signed in as {permissions.email ?? 'an unknown account'}. This invite is for{' '}
                  {invitation.invitee_email}.
                </p>
                <SwitchAccountButton inviteeEmail={invitation.invitee_email} invitePath={invitePath} />
              </div>
            ) : (
              <form action={acceptAdminInvitationAction} className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="invitation_id" value={invitation.id} />
                <button type="submit" className="qv-button-primary">
                  Accept admin access
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
