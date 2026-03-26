import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { getOrganizationAdminInvitationByRawToken } from '@/lib/organizations/admin-invitations'
import { acceptAdminInvitationAction } from './actions'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        {errorMessage ? <p className="qv-inline-message qv-inline-error">{errorMessage}</p> : null}
        {noticeMessage ? <p className="qv-inline-message qv-inline-success">{noticeMessage}</p> : null}

        <section className="qv-card qv-compact-card">
          <h1 className="qv-section-title">Admin invite onboarding</h1>
          <div className="qv-form-grid" style={{ marginTop: 18 }}>
              <p className="qv-section-subtitle" style={{ marginTop: 0 }}>
                You were invited to manage {invitation.organizationName}
                {invitation.councilName ? ` for ${invitation.councilName}` : ''}.
              </p>
              <div className="qv-custom-list-review-box">
                <div>
                  <div className="qv-detail-label">Invited email</div>
                  <div className="qv-detail-value">{invitation.invitee_email}</div>
                </div>
                {invitation.invitee_name ? (
                  <div>
                    <div className="qv-detail-label">Invited name</div>
                    <div className="qv-detail-value">{invitation.invitee_name}</div>
                  </div>
                ) : null}
                {invitation.notes ? (
                  <div>
                    <div className="qv-detail-label">Onboarding notes</div>
                    <div className="qv-detail-value">{invitation.notes}</div>
                  </div>
                ) : null}
                <div>
                  <div className="qv-detail-label">Status</div>
                  <div className="qv-detail-value">
                    {invitation.isExpired
                      ? 'Expired'
                      : invitation.status_code.charAt(0).toUpperCase() + invitation.status_code.slice(1)}
                  </div>
                </div>
              </div>

              {!permissions.authUser ? (
                <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
                  <Link
                    href={`/login?next=${encodeURIComponent(`/admin-invite?token=${token}`)}`}
                    className="qv-link-button qv-button-primary"
                  >
                    Sign in to continue
                  </Link>
                </div>
              ) : invitation.status_code !== 'pending' || invitation.isExpired ? (
                <p className="qv-inline-message">
                  This invite can no longer be accepted. Ask a current admin to send a fresh one.
                </p>
              ) : signedInEmail !== invitation.invitee_email ? (
                <p className="qv-inline-message qv-inline-error">
                  You are signed in as {permissions.email ?? 'an unknown account'}. This invite is for{' '}
                  {invitation.invitee_email}.
                </p>
              ) : (
                <form action={acceptAdminInvitationAction} className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="invitation_id" value={invitation.id} />
                  <button type="submit" className="qv-button-primary">
                    Accept admin invite
                  </button>
                </form>
              )}
            </div>
        </section>
      </div>
    </main>
  )
}
