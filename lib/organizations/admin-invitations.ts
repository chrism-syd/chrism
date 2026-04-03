import { createHash, randomBytes } from 'node:crypto'
import { buildAuthConfirmRedirectUrl } from '@/lib/auth/redirects'
import { sendBrevoTransactionalEmail } from '@/lib/email/brevo'
import {
  normalizeAdminGrantEmail,
  saveOrganizationAdminAssignment,
} from '@/lib/organizations/admin-assignments'
import { createAdminClient } from '@/lib/supabase/admin'

export type OrganizationAdminInvitationStatusCode = 'pending' | 'accepted' | 'revoked' | 'expired'

type InvitationRow = {
  id: string
  organization_id: string
  council_id: string | null
  invitee_email: string
  invitee_name: string | null
  status_code: OrganizationAdminInvitationStatusCode
  notes: string | null
  selector: string
  token_hash: string
  expires_at: string
  accepted_assignment_id: string | null
  accepted_at: string | null
}

function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function getBaseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SITE_URL

  if (explicit) {
    return explicit.replace(/\/+$/, '')
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  return 'http://localhost:3000'
}

export function normalizeAdminInviteText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeAdminInviteEmail(value: string | null | undefined) {
  return normalizeAdminGrantEmail(value)
}

export function buildAdminInvitationToken() {
  const rawToken = randomBytes(24).toString('hex')
  return {
    rawToken,
    selector: rawToken.slice(0, 12),
    tokenHash: hashToken(rawToken),
  }
}

export function buildAdminInvitationPath(rawToken: string) {
  return `/admin-invite?token=${encodeURIComponent(rawToken)}`
}

export async function createOrganizationAdminInvitation(args: {
  organizationId: string
  councilId?: string | null
  invitedByAuthUserId: string
  inviteeEmail: string
  inviteeName?: string | null
  notes?: string | null
  expiresInDays?: number
}) {
  const admin = createAdminClient()
  const normalizedEmail = normalizeAdminInviteEmail(args.inviteeEmail)

  if (!normalizedEmail) {
    throw new Error('Enter an email address before sending the admin invite.')
  }

  const token = buildAdminInvitationToken()
  const expiresAt = new Date(Date.now() + (args.expiresInDays ?? 10) * 24 * 60 * 60 * 1000).toISOString()

  const { data: existingRows, error: existingError } = await admin
    .from('organization_admin_invitations')
    .select('id, status_code')
    .eq('organization_id', args.organizationId)
    .ilike('invitee_email', normalizedEmail)
    .in('status_code', ['pending', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(5)

  if (existingError) {
    throw new Error(existingError.message)
  }

  const activeInvite = ((existingRows as { id: string; status_code: OrganizationAdminInvitationStatusCode }[] | null) ?? []).find(
    (row) => row.status_code === 'pending'
  )

  const invitePayload = {
    organization_id: args.organizationId,
    council_id: args.councilId ?? null,
    invited_by_auth_user_id: args.invitedByAuthUserId,
    invitee_email: normalizedEmail,
    invitee_name: normalizeAdminInviteText(args.inviteeName ?? null),
    status_code: 'pending',
    notes: normalizeAdminInviteText(args.notes ?? null),
    selector: token.selector,
    token_hash: token.tokenHash,
    expires_at: expiresAt,
    accepted_by_auth_user_id: null,
    accepted_assignment_id: null,
    accepted_at: null,
    revoked_by_auth_user_id: null,
    revoked_at: null,
    revoked_notes: null,
    updated_by_auth_user_id: args.invitedByAuthUserId,
  }

  if (activeInvite?.id) {
    const { error } = await admin
      .from('organization_admin_invitations')
      .update(invitePayload)
      .eq('id', activeInvite.id)

    if (error) {
      throw new Error(error.message)
    }

    return {
      invitationId: activeInvite.id,
      rawToken: token.rawToken,
      invitePath: buildAdminInvitationPath(token.rawToken),
    }
  }

  const { data, error } = await admin
    .from('organization_admin_invitations')
    .insert({
      ...invitePayload,
      created_by_auth_user_id: args.invitedByAuthUserId,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return {
    invitationId: (data as { id: string } | null)?.id ?? null,
    rawToken: token.rawToken,
    invitePath: buildAdminInvitationPath(token.rawToken),
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildAdminInvitationAuthPath(args: { baseUrl: string; invitePath: string; tokenHash: string; type?: string | null }) {
  const confirmUrl = new URL('/admin-invite/confirm', args.baseUrl)
  const safeNextPath = buildAuthConfirmRedirectUrl(args.baseUrl, args.invitePath)
  const nextPath = new URL(safeNextPath).searchParams.get('next')
  if (nextPath) {
    confirmUrl.searchParams.set('next', nextPath)
  }
  confirmUrl.searchParams.set('token_hash', args.tokenHash)
  confirmUrl.searchParams.set('type', args.type || 'magiclink')
  return confirmUrl.toString()
}

function buildAdminInvitationEmailCopy(args: {
  organizationName: string
  councilName?: string | null
  councilNumber?: string | null
  inviteeName?: string | null
  inviterName?: string | null
  notes?: string | null
  acceptUrl: string
}) {
  const organizationLabel = args.organizationName.trim() || 'this organization'
  const councilBits = [args.councilName?.trim(), args.councilNumber ? `Council ${args.councilNumber}` : null].filter(Boolean)
  const councilLabel = councilBits.length > 0 ? councilBits.join(' • ') : null
  const greetingName = args.inviteeName?.trim() || 'there'
  const inviterLine = args.inviterName?.trim() ? `${args.inviterName.trim()} invited you to help manage` : 'You were invited to help manage'
  const notesHtml = args.notes?.trim()
    ? `<p style="margin:16px 0 0;color:#334155;font-size:15px;line-height:1.6;"><strong>Onboarding notes:</strong> ${escapeHtml(args.notes.trim())}</p>`
    : ''
  const notesText = args.notes?.trim() ? `

Onboarding notes: ${args.notes.trim()}` : ''
  const councilHtml = councilLabel ? `<p style="margin:8px 0 0;color:#475569;font-size:14px;">${escapeHtml(councilLabel)}</p>` : ''
  const councilText = councilLabel ? `
${councilLabel}` : ''
  const subject = `You are invited to manage ${organizationLabel} on Chrism`
  const htmlContent = `
    <div style="background:#f8fafc;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:32px;">
        <p style="margin:0 0 12px;font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">Chrism admin invite</p>
        <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#0f172a;">You have been invited to help manage ${escapeHtml(organizationLabel)}</h1>
        <p style="margin:0;color:#334155;font-size:16px;line-height:1.6;">Hi ${escapeHtml(greetingName)},</p>
        <p style="margin:16px 0 0;color:#334155;font-size:16px;line-height:1.6;">${escapeHtml(inviterLine)} <strong>${escapeHtml(organizationLabel)}</strong> in Chrism.</p>
        ${councilHtml}
        ${notesHtml}
        <div style="margin:28px 0;">
          <a href="${escapeHtml(args.acceptUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600;">Accept admin invite</a>
        </div>
        <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">This secure link will sign you in or finish creating your account, then bring you straight to the invite acceptance screen.</p>
        <p style="margin:16px 0 0;color:#64748b;font-size:13px;line-height:1.6;word-break:break-word;">If the button does not work, paste this link into your browser:<br>${escapeHtml(args.acceptUrl)}</p>
      </div>
    </div>
  `.trim()
  const textContent = `Hi ${greetingName},

${inviterLine} ${organizationLabel} in Chrism.${councilText}${notesText}

Accept your admin invite:
${args.acceptUrl}

This secure link will sign you in or finish creating your account, then bring you straight to the invite acceptance screen.`

  return {
    subject,
    htmlContent,
    textContent,
  }
}

export async function sendOrganizationAdminInvitationEmail(args: {
  inviteeEmail: string
  inviteeName?: string | null
  invitePath: string
  organizationName: string
  councilName?: string | null
  councilNumber?: string | null
  inviterName?: string | null
  notes?: string | null
  origin?: string | null
}) {
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: args.inviteeEmail,
  })

  if (error) {
    throw new Error(error.message)
  }

  const properties = (data as { properties?: { hashed_token?: string | null; verification_type?: string | null } } | null)?.properties
  const tokenHash = properties?.hashed_token?.trim()

  if (!tokenHash) {
    throw new Error('Supabase did not return a hashed invite token for this admin invite.')
  }

  const acceptUrl = buildAdminInvitationAuthPath({
    baseUrl: args.origin || getBaseUrl(),
    invitePath: args.invitePath,
    tokenHash,
    type: properties?.verification_type ?? 'magiclink',
  })

  const emailCopy = buildAdminInvitationEmailCopy({
    organizationName: args.organizationName,
    councilName: args.councilName,
    councilNumber: args.councilNumber,
    inviteeName: args.inviteeName,
    inviterName: args.inviterName,
    notes: args.notes,
    acceptUrl,
  })

  await sendBrevoTransactionalEmail({
    to: [{
      email: args.inviteeEmail,
      name: args.inviteeName ?? undefined,
    }],
    subject: emailCopy.subject,
    htmlContent: emailCopy.htmlContent,
    textContent: emailCopy.textContent,
  })
}

export async function getOrganizationAdminInvitationByRawToken(rawToken: string) {
  const admin = createAdminClient()
  const tokenHash = hashToken(rawToken)
  const { data, error } = await admin
    .from('organization_admin_invitations')
    .select(
      'id, organization_id, council_id, invitee_email, invitee_name, status_code, notes, expires_at, accepted_assignment_id, accepted_at, organizations(display_name, preferred_name), councils(name, council_number)'
    )
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const row = data as
    | (InvitationRow & {
        organizations:
          | { display_name: string | null; preferred_name: string | null }
          | Array<{ display_name: string | null; preferred_name: string | null }>
          | null
        councils:
          | { name: string | null; council_number: string | null }
          | Array<{ name: string | null; council_number: string | null }>
          | null
      })
    | null

  const organization = Array.isArray(row?.organizations) ? row?.organizations[0] : row?.organizations
  const council = Array.isArray(row?.councils) ? row?.councils[0] : row?.councils

  return row
    ? {
        ...row,
        organizationName: organization?.preferred_name ?? organization?.display_name ?? 'this organization',
        councilName: council?.name ?? null,
        councilNumber: council?.council_number ?? null,
        isExpired: new Date(row.expires_at).getTime() < Date.now(),
      }
    : null
}

export async function acceptOrganizationAdminInvitation(args: {
  invitationId: string
  rawToken: string
  acceptedByAuthUserId: string
  acceptedByPersonId?: string | null
  acceptedByEmail: string
}) {
  const invitation = await getOrganizationAdminInvitationByRawToken(args.rawToken)

  if (!invitation || invitation.id !== args.invitationId) {
    throw new Error('That admin invite could not be found.')
  }

  if (invitation.status_code !== 'pending') {
    throw new Error('That admin invite is no longer pending.')
  }

  if (invitation.isExpired) {
    throw new Error('That admin invite has expired. Ask a current admin to send a new one.')
  }

  const acceptedByEmail = normalizeAdminInviteEmail(args.acceptedByEmail)
  if (!acceptedByEmail || acceptedByEmail !== invitation.invitee_email) {
    throw new Error(`This invite is for ${invitation.invitee_email}. Sign in with that email to accept it.`)
  }

  const savedAssignment = await saveOrganizationAdminAssignment({
    organizationId: invitation.organization_id,
    actorUserId: args.acceptedByAuthUserId,
    personId: args.acceptedByPersonId ?? null,
    userId: args.acceptedByAuthUserId,
    granteeEmail: acceptedByEmail,
    sourceCode: 'admin_invitation',
    grantNotes: invitation.notes,
  })

  const admin = createAdminClient()
  const { error } = await admin
    .from('organization_admin_invitations')
    .update({
      status_code: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by_auth_user_id: args.acceptedByAuthUserId,
      accepted_assignment_id: savedAssignment.id,
      updated_by_auth_user_id: args.acceptedByAuthUserId,
    })
    .eq('id', invitation.id)
    .eq('status_code', 'pending')

  if (error) {
    throw new Error(error.message)
  }
}

export async function revokeOrganizationAdminInvitation(args: {
  invitationId: string
  organizationId: string
  revokedByAuthUserId: string
  revokeNotes?: string | null
}) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('organization_admin_invitations')
    .update({
      status_code: 'revoked',
      revoked_at: new Date().toISOString(),
      revoked_by_auth_user_id: args.revokedByAuthUserId,
      revoked_notes: normalizeAdminInviteText(args.revokeNotes ?? null),
      updated_by_auth_user_id: args.revokedByAuthUserId,
    })
    .eq('id', args.invitationId)
    .eq('organization_id', args.organizationId)

  if (error) {
    throw new Error(error.message)
  }
}
