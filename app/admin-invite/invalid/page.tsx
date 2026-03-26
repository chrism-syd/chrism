import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { getOrganizationAdminInvitationByRawToken } from '@/lib/organizations/admin-invitations'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

type InviteState = {
  headline: string
  body: string
  canRetryViaLogin: boolean
}

function getInviteState(args: {
  reason: string | null
  invitation:
    | Awaited<ReturnType<typeof getOrganizationAdminInvitationByRawToken>>
    | null
}) : InviteState {
  const invitation = args.invitation

  if (!invitation) {
    return {
      headline: 'This invite could not be found',
      body: 'The link may be incomplete or no longer valid. Ask a current admin to send you a fresh invite.',
      canRetryViaLogin: false,
    }
  }

  if (invitation.status_code === 'revoked') {
    return {
      headline: 'This invite was revoked',
      body: 'A current admin withdrew this invite before it could be used. Ask them to send you a fresh one if you still need access.',
      canRetryViaLogin: false,
    }
  }

  if (invitation.status_code === 'accepted') {
    return {
      headline: 'This invite was already used',
      body: 'That secure link has already done its job. If your admin access was later removed, ask a current admin to send you a new invite.',
      canRetryViaLogin: false,
    }
  }

  if (invitation.isExpired) {
    return {
      headline: 'This invite expired',
      body: 'The invite is still on file, but the secure link window has expired. Ask a current admin to send a fresh invite.',
      canRetryViaLogin: false,
    }
  }

  if (args.reason === 'auth') {
    return {
      headline: 'This sign-in link is no longer valid',
      body: 'Your invite is still pending, but the one-time sign-in link cannot be used anymore. Sign in again with the invited email to continue.',
      canRetryViaLogin: true,
    }
  }

  return {
    headline: 'This invite is no longer valid',
    body: 'Ask a current admin to send you a fresh invite if you still need access.',
    canRetryViaLogin: false,
  }
}

export default async function InvalidAdminInvitePage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const token = typeof resolvedSearchParams.token === 'string' ? resolvedSearchParams.token : null
  const reason = typeof resolvedSearchParams.reason === 'string' ? resolvedSearchParams.reason : null

  if (!token) {
    redirect('/me?error=Missing admin invite token.')
  }

  const permissions = await getCurrentUserPermissions()
  const invitation = await getOrganizationAdminInvitationByRawToken(token)
  const inviteState = getInviteState({ reason, invitation })
  const loginHref = `/login?next=${encodeURIComponent(`/admin-invite?token=${token}`)}`

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-card qv-compact-card">
          <p className="qv-detail-label">Admin invite status</p>
          <h1 className="qv-section-title" style={{ marginTop: 8 }}>{inviteState.headline}</h1>
          <p className="qv-section-subtitle" style={{ marginTop: 10 }}>{inviteState.body}</p>

          {invitation ? (
            <div className="qv-custom-list-review-box" style={{ marginTop: 18 }}>
              <div>
                <div className="qv-detail-label">Organization</div>
                <div className="qv-detail-value">{invitation.organizationName}</div>
              </div>
              {invitation.councilName ? (
                <div>
                  <div className="qv-detail-label">Council</div>
                  <div className="qv-detail-value">
                    {invitation.councilName}
                    {invitation.councilNumber ? ` • Council ${invitation.councilNumber}` : ''}
                  </div>
                </div>
              ) : null}
              <div>
                <div className="qv-detail-label">Invited email</div>
                <div className="qv-detail-value">{invitation.invitee_email}</div>
              </div>
              <div>
                <div className="qv-detail-label">Current invite status</div>
                <div className="qv-detail-value">
                  {invitation.isExpired
                    ? 'Expired'
                    : invitation.status_code.charAt(0).toUpperCase() + invitation.status_code.slice(1)}
                </div>
              </div>
            </div>
          ) : null}

          <div className="qv-form-actions" style={{ justifyContent: 'flex-start', marginTop: 20 }}>
            {inviteState.canRetryViaLogin ? (
              <Link href={loginHref} className="qv-link-button qv-button-primary">
                Sign in with the invited email
              </Link>
            ) : null}
            <Link href={permissions.authUser ? '/me' : '/login'} className="qv-link-button qv-button-secondary">
              {permissions.authUser ? 'Go to my account' : 'Go to login'}
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
