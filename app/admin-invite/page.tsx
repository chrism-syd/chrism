import Image from 'next/image'
import Link from 'next/link'
import ClearFlashMessageCookie from '@/app/components/clear-flash-message-cookie'
import FormSubmitButton from '@/app/components/form-submit-button'
import OrganizationAvatar from '@/app/components/organization-avatar'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { consumeFlashMessage } from '@/lib/flash-messages'
import { getEffectiveOrganizationBranding, getEffectiveOrganizationName } from '@/lib/organizations/names'
import { getOrganizationAdminInvitationByRawToken } from '@/lib/organizations/admin-invitations'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { acceptAdminInvitationAction } from './actions'
import InviteSignInForm from './invite-sign-in-form'
import SwitchAccountButton from './switch-account-button'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type OrganizationRow = {
  id: string
  display_name: string | null
  preferred_name: string | null
  logo_storage_path: string | null
  logo_alt_text: string | null
  brand_profile?: {
    code: string | null
    display_name: string | null
    logo_storage_bucket: string | null
    logo_storage_path: string | null
    logo_alt_text: string | null
  } | null
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

const adminInvitePillStyle = {
  alignItems: 'center',
  background: 'color-mix(in srgb, #6ea84f 22%, var(--bg-card))',
  border: '1px solid color-mix(in srgb, #6ea84f 34%, var(--divider))',
  borderRadius: 999,
  color: '#477a2f',
  display: 'inline-flex',
  fontSize: 16,
  fontWeight: 800,
  gap: 8,
  letterSpacing: '-0.01em',
  padding: '9px 18px',
  whiteSpace: 'nowrap',
  width: 'fit-content',
} as const

export default async function AdminInvitePage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const token = typeof resolvedSearchParams.token === 'string' ? resolvedSearchParams.token : null
  const queryErrorMessage = typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : null
  const queryNoticeMessage = typeof resolvedSearchParams.notice === 'string' ? resolvedSearchParams.notice : null
  const flashMessage = await consumeFlashMessage('/admin-invite')
  const errorMessage = flashMessage?.kind === 'error' ? flashMessage.message : queryErrorMessage
  const noticeMessage = flashMessage?.kind === 'notice' ? flashMessage.message : queryNoticeMessage
  const shouldClearFlashMessage = Boolean(flashMessage)

  if (!token) {
    redirect('/admin-invite/invalid?reason=missing')
  }

  const invitation = await getOrganizationAdminInvitationByRawToken(token)

  if (!invitation) {
    redirect(`/admin-invite/invalid?reason=missing&token=${encodeURIComponent(token)}`)
  }

  const [permissions, organizationResult] = await Promise.all([
    getCurrentUserPermissions(),
    createAdminClient()
      .from('organizations')
      .select('id, display_name, preferred_name, logo_storage_path, logo_alt_text, brand_profile:brand_profile_id(code, display_name, logo_storage_bucket, logo_storage_path, logo_alt_text)')
      .eq('id', invitation.organization_id)
      .maybeSingle(),
  ])

  const organization = (organizationResult.data as OrganizationRow | null) ?? null
  const effectiveBranding = getEffectiveOrganizationBranding(organization)
  const signedInEmail = permissions.email?.trim().toLowerCase() ?? null
  const invitePath = `/admin-invite?token=${encodeURIComponent(token)}`
  const acceptPath = `/admin-invite/accept?token=${encodeURIComponent(token)}&invitation_id=${encodeURIComponent(invitation.id)}`
  const councilLabel = [invitation.councilName, invitation.councilNumber ? `Council ${invitation.councilNumber}` : null]
    .filter(Boolean)
    .join(' · ')
  const orgLabel = getEffectiveOrganizationName(organization) ?? invitation.organizationName ?? 'this organization'
  const inviteCannotBeAccepted = invitation.status_code !== 'pending' || invitation.isExpired
  const inviteeName = invitation.invitee_name?.trim() || 'Invited admin'
  const showPageLevelMessage = !permissions.authUser

  return (
    <main className="qv-page">
      <div className="qv-shell" style={{ maxWidth: 1120 }}>
        <header className="qv-app-header" style={{ paddingTop: 0, paddingBottom: 8 }}>
          <div className="qv-app-header-left">
            <Link href="/" className="qv-brand" aria-label="Chrism home">
              <Image
                src="/Chrism_horiz.svg"
                alt="Chrism"
                width={280}
                height={94}
                className="qv-brand-logo"
                priority
              />
            </Link>
          </div>
        </header>
        {shouldClearFlashMessage ? <ClearFlashMessageCookie /> : null}

        <section style={{ display: 'grid', gap: 10, marginBottom: 32 }}>
          <h1 className="qv-directory-name" style={{ margin: 0, maxWidth: 940, fontSize: 'clamp(48px, 7vw, 86px)', lineHeight: 0.94 }}>
            You&apos;ve been invited to manage an organization
          </h1>
          <p className="qv-section-subtitle" style={{ margin: 0, maxWidth: 860, fontSize: 'clamp(18px, 2.2vw, 26px)', lineHeight: 1.25 }}>
            Review the details below, then verify your email to accept admin access.
          </p>
        </section>

        {showPageLevelMessage && errorMessage ? (
          <section className="qv-inline-message qv-inline-error" aria-live="assertive">
            <p style={{ margin: 0 }}>{errorMessage}</p>
          </section>
        ) : null}
        {showPageLevelMessage && noticeMessage ? (
          <section className="qv-inline-message qv-inline-success" aria-live="polite">
            <p style={{ margin: 0 }}>{noticeMessage}</p>
          </section>
        ) : null}

        <section className="qv-hero-card" style={{ display: 'grid', gap: 26 }}>
          <div className="qv-card" style={{ alignItems: 'center', display: 'flex', gap: 22, margin: 0, padding: '24px 28px' }}>
            <OrganizationAvatar
              displayName={orgLabel}
              logoStoragePath={effectiveBranding.logo_storage_path}
              logoAltText={effectiveBranding.logo_alt_text ?? orgLabel}
              size={76}
            />
            <div style={{ display: 'grid', gap: 5, minWidth: 0 }}>
              <h2 className="qv-section-title" style={{ margin: 0, fontSize: 'clamp(24px, 3.4vw, 34px)' }}>{orgLabel}</h2>
              {councilLabel ? <p className="qv-section-subtitle" style={{ margin: 0 }}>{councilLabel}</p> : null}
            </div>
            <span style={{ ...adminInvitePillStyle, marginLeft: 'auto' }}>
              <span aria-hidden="true">✉</span>
              <span>Admin invite</span>
            </span>
          </div>

          <div className="qv-card" style={{ display: 'grid', gap: 10, margin: 0 }}>
            <div
              style={{
                color: 'var(--text-primary)',
                fontSize: 'clamp(20px, 2.4vw, 26px)',
                fontWeight: 800,
                lineHeight: 1.16,
              }}
            >
              {inviteeName}
            </div>
            <div style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 650 }}>
              {invitation.invitee_email}
            </div>
            <p className="qv-section-subtitle" style={{ alignItems: 'center', display: 'flex', gap: 8, margin: '6px 0 0' }}>
              <span aria-hidden="true">🔒</span>
              <span>This invite is only valid for the email address above and can only be used once.</span>
            </p>
            <Link
              href="/"
              style={{
                color: 'var(--text-secondary)',
                fontSize: 14,
                fontWeight: 700,
                marginTop: 4,
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                width: 'fit-content',
              }}
            >
              This is not me or my email address
            </Link>
          </div>

          <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 26 }}>
            {!permissions.authUser ? (
              inviteCannotBeAccepted ? (
                <p className="qv-inline-message qv-inline-error">
                  This invite can no longer be accepted. Ask a current admin to send a fresh one.
                </p>
              ) : (
                <InviteSignInForm acceptPath={acceptPath} inviteeEmail={invitation.invitee_email} invitePath={invitePath} />
              )
            ) : inviteCannotBeAccepted ? (
              <p className="qv-inline-message qv-inline-error">
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
              <form action={acceptAdminInvitationAction} className="qv-form-grid" style={{ maxWidth: 680 }}>
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="invitation_id" value={invitation.id} />
                <div style={{ display: 'grid', gap: 8 }}>
                  <h2 className="qv-section-title" style={{ margin: 0, fontSize: 'clamp(26px, 3.2vw, 36px)' }}>
                    Enter the shared verification phrase
                  </h2>
                  <p className="qv-section-subtitle" style={{ margin: 0 }}>
                    This is the phrase provided separately by the person who invited you.
                  </p>
                </div>
                <label className="qv-field">
                  <span>Shared verification phrase</span>
                  <input
                    name="challenge_response"
                    type="text"
                    placeholder="Phrase from the person who invited you"
                    required
                  />
                </label>
                {errorMessage ? (
                  <p className="qv-inline-message qv-inline-error" style={{ margin: 0 }} aria-live="assertive">
                    {errorMessage}
                  </p>
                ) : null}
                {noticeMessage ? (
                  <p className="qv-inline-message qv-inline-success" style={{ margin: 0 }} aria-live="polite">
                    {noticeMessage}
                  </p>
                ) : null}
                <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
                  <FormSubmitButton
                    idleLabel="Verify phrase and accept access"
                    pendingLabel="Accepting access..."
                    className="qv-button-primary"
                  />
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
