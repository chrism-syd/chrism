import { createHash, randomBytes } from 'node:crypto'
import { sendBrevoTransactionalEmail } from '@/lib/email/brevo'
import {
  normalizeAdminGrantEmail,
  saveOrganizationAdminAssignment,
} from '@/lib/organizations/admin-assignments'
import { createAdminClient } from '@/lib/supabase/admin'
import { protectPeoplePayload } from '@/lib/security/pii'
import { applyNonBreakingTextRules } from '@/lib/text/non-breaking'

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

type SenderPersonRow = {
  first_name: string | null
  last_name: string | null
  nickname: string | null
}

const EMAIL_SANS_FONT_STACK = "'Atkinson Hyperlegible Next','Atkinson Hyperlegible',Arial,Helvetica,sans-serif"

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
  return trimmed.length > 0 ? applyNonBreakingTextRules(trimmed) : null
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

function formatPersonDisplayName(row: SenderPersonRow | null) {
  if (!row) return null

  const first = row.nickname?.trim() || row.first_name?.trim() || ''
  const last = row.last_name?.trim() || ''
  const name = [first, last].filter(Boolean).join(' ').trim()

  return name ? applyNonBreakingTextRules(name) : null
}

async function resolveSenderNameByPersonId(admin: ReturnType<typeof createAdminClient>, personId: string | null | undefined) {
  if (!personId) return null

  const { data, error } = await admin
    .from('people')
    .select('first_name, last_name, nickname')
    .eq('id', personId)
    .maybeSingle<SenderPersonRow>()

  if (error) return null

  return formatPersonDisplayName(data)
}

async function resolveSenderPersonIdFromAssignments(admin: ReturnType<typeof createAdminClient>, senderUserId: string) {
  const { data: organizationAssignments } = await admin
    .from('organization_admin_assignments')
    .select('person_id')
    .eq('user_id', senderUserId)
    .eq('is_active', true)
    .limit(10)

  const organizationPersonId = ((organizationAssignments as Array<{ person_id: string | null }> | null) ?? [])
    .find((row) => Boolean(row.person_id))?.person_id

  if (organizationPersonId) return organizationPersonId

  const { data: councilAssignments } = await admin
    .from('council_admin_assignments')
    .select('person_id')
    .eq('user_id', senderUserId)
    .eq('is_active', true)
    .limit(10)

  const councilPersonId = ((councilAssignments as Array<{ person_id: string | null }> | null) ?? [])
    .find((row) => Boolean(row.person_id))?.person_id

  if (councilPersonId) return councilPersonId

  const { data: linkedRelationships } = await admin
    .from('user_unit_relationships')
    .select('member_record:member_record_id(legacy_people_id)')
    .eq('user_id', senderUserId)
    .eq('status', 'active')
    .limit(10)

  const linkedPersonId = ((linkedRelationships as Array<{ member_record?: { legacy_people_id: string | null } | null }> | null) ?? [])
    .find((row) => Boolean(row.member_record?.legacy_people_id))?.member_record?.legacy_people_id

  return linkedPersonId ?? null
}

async function resolveAdminInviteSenderName(invitePath: string) {
  try {
    const rawToken = new URL(invitePath, 'https://chrism.app').searchParams.get('token')?.trim()
    if (!rawToken) return null

    const admin = createAdminClient()
    const { data: invitation, error: invitationError } = await admin
      .from('organization_admin_invitations')
      .select('invited_by_auth_user_id')
      .eq('token_hash', hashToken(rawToken))
      .maybeSingle<{ invited_by_auth_user_id: string | null }>()

    const senderUserId = invitation?.invited_by_auth_user_id ?? null
    if (invitationError || !senderUserId) return null

    const { data: appUser } = await admin
      .from('users')
      .select('person_id')
      .eq('id', senderUserId)
      .maybeSingle<{ person_id: string | null }>()

    const directName = await resolveSenderNameByPersonId(admin, appUser?.person_id)
    if (directName) return directName

    const assignmentPersonId = await resolveSenderPersonIdFromAssignments(admin, senderUserId)
    return resolveSenderNameByPersonId(admin, assignmentPersonId)
  } catch {
    return null
  }
}

function buildAdminInvitationEmailCopy(args: {
  organizationName: string
  councilName?: string | null
  councilNumber?: string | null
  inviteeName?: string | null
  inviterName?: string | null
  notes?: string | null
  acceptUrl: string
  logoUrl?: string | null
}) {
  const organizationLabel = applyNonBreakingTextRules(args.organizationName.trim() || 'this organization')
  const normalizedCouncilName = args.councilName?.trim() ? applyNonBreakingTextRules(args.councilName.trim()) : null
  const councilBits = [normalizedCouncilName, args.councilNumber ? `Council ${args.councilNumber}` : null].filter(Boolean)
  const councilLabel = councilBits.length > 0 ? councilBits.join(' · ') : null
  const greetingName = applyNonBreakingTextRules(args.inviteeName?.trim() || 'there')
  const candidateInviterName = applyNonBreakingTextRules(args.inviterName?.trim() ?? '')
  const inviterDisplayName = candidateInviterName && !candidateInviterName.includes('@') ? candidateInviterName : null
  const inviterText = inviterDisplayName ? `, ${inviterDisplayName},` : ''
  const inviterLine = `An admin of ${organizationLabel} on Chrism.app${inviterText} has invited you to join them as an admin.`
  const subject = `Admin invite for ${organizationLabel}`
  const notesHtml = args.notes?.trim()
    ? `<div style="margin-top:18px;padding:16px 18px;border-radius:18px;background:#ede9e1;border:1px solid rgba(92,74,114,0.15);"><p style="margin:0 0 6px;color:#9a917e;font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:800;">Onboarding note</p><p style="margin:0;color:#2e2a34;font-size:15px;line-height:1.6;">${escapeHtml(applyNonBreakingTextRules(args.notes.trim()))}</p></div>`
    : ''
  const notesText = args.notes?.trim() ? `\n\nOnboarding note:\n${applyNonBreakingTextRules(args.notes.trim())}` : ''
  const councilHtml = councilLabel
    ? `<p style="margin:8px 0 0;color:#6f8594;font-size:15px;line-height:1.5;font-weight:650;">${escapeHtml(councilLabel)}</p>`
    : ''
  const councilText = councilLabel ? `\n${councilLabel}` : ''

  const htmlContent = `
    <div style="margin:0;padding:0;background:#ffffff;font-family:${EMAIL_SANS_FONT_STACK};color:#2e2a34;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;margin:0;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fdfcf9;border:1px solid rgba(92,74,114,0.15);border-radius:20px;overflow:hidden;">
              <tr>
                <td style="padding:34px 34px 18px;">
                  ${args.logoUrl ? `<img src="${escapeHtml(args.logoUrl)}" alt="Chrism" width="210" style="display:block;width:210px;height:auto;border:0;margin:0 0 34px;" />` : ''}
                  <h1 style="margin:0;color:#2e2a34;font-family:${EMAIL_SANS_FONT_STACK};font-size:34px;line-height:1.12;letter-spacing:-.03em;font-weight:800;">You have been invited to manage ${escapeHtml(organizationLabel)}</h1>
                  ${councilHtml}
                </td>
              </tr>
              <tr>
                <td style="padding:0 34px 8px;">
                  <p style="margin:0;color:#2e2a34;font-size:16px;line-height:1.65;">Hi ${escapeHtml(greetingName)},</p>
                  <p style="margin:16px 0 0;color:#2e2a34;font-size:16px;line-height:1.65;">${escapeHtml(inviterLine)}</p>
                  ${notesHtml}
                  <p style="margin:16px 0 0;color:#2e2a34;font-size:16px;line-height:1.65;">Chrism.app helps ministries and local organizations manage people, events, and volunteer work in one secure workspace.</p>
                  <p style="margin:16px 0 0;color:#2e2a34;font-size:16px;line-height:1.65;">To accept this invite, review the details in Chrism. You will be asked to verify your email with a one-time code and <strong>enter the shared verification phrase</strong> provided by the person who invited you. For security, that phrase is not included in this email.</p>
                </td>
              </tr>
              <tr>
                <td align="left" style="padding:18px 34px 22px;">
                  <a href="${escapeHtml(args.acceptUrl)}" style="display:inline-block;background:#5c4a72;color:#ffffff;text-decoration:none;padding:16px 22px;border-radius:14px;font-family:${EMAIL_SANS_FONT_STACK};font-size:16px;line-height:1;font-weight:800;">Review admin invite</a>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 34px 0;">
                  <div style="height:1px;background:rgba(92,74,114,0.16);line-height:1px;font-size:1px;">&nbsp;</div>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 34px 34px;">
                  <p style="margin:0;color:#6f8594;font-size:14px;line-height:1.65;">Only the invited email address can accept this invite. The shared verification phrase should come directly from the person who invited you, not from this email.</p>
                  <p style="margin:16px 0 0;color:#6f8594;font-size:14px;line-height:1.65;">If the button does not work, paste this link into your browser:</p>
                  <p style="margin:8px 0 0;color:#6f8594;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${escapeHtml(args.acceptUrl)}" style="color:#5c4a72;text-decoration:underline;">${escapeHtml(args.acceptUrl)}</a></p>
                  <p style="margin:16px 0 0;color:#6f8594;font-size:14px;line-height:1.65;">If you were not expecting this invite, you can ignore this email. Be cautious of phishing attempts and always verify the sender and domain (<a href="https://chrism.app" style="color:#5c4a72;text-decoration:underline;">chrism.app</a>) before acting.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `.trim()

  const textContent = `Hi ${greetingName},\n\n${inviterLine}${councilText}${notesText}\n\nChrism.app helps ministries and local organizations manage people, events, and volunteer work in one secure workspace.\n\nClick the link below to accept this invite. You will be asked to verify your email with a one-time code and enter the shared verification phrase provided by the person who invited you. For security, that phrase is not included in this email.\n\nReview admin invite:\n${args.acceptUrl}\n\nOnly the invited email address can accept this invite.`

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
  const baseUrl = args.origin || getBaseUrl()
  const acceptUrl = new URL(args.invitePath, baseUrl).toString()
  const resolvedInviterName = args.inviterName ?? await resolveAdminInviteSenderName(args.invitePath)

  const emailCopy = buildAdminInvitationEmailCopy({
    organizationName: args.organizationName,
    councilName: args.councilName,
    councilNumber: args.councilNumber,
    inviteeName: args.inviteeName,
    inviterName: resolvedInviterName,
    notes: args.notes,
    acceptUrl,
    logoUrl: `${baseUrl}/Chrism.png`,
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

function inferNameParts(fullName: string | null, email: string | null) {
  const source = fullName?.trim() || email?.split('@')[0]?.replace(/[._-]+/g, ' ')?.trim() || 'Admin Contact'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length <= 1) {
    return {
      firstName: parts[0] ?? 'Admin',
      lastName: 'Contact',
    }
  }

  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts.slice(-1)[0] ?? 'Contact',
  }
}

async function ensureAcceptedInvitePerson(args: {
  authUserId: string
  acceptedByPersonId?: string | null
  acceptedByEmail: string
  inviteeName?: string | null
  councilId?: string | null
}) {
  const admin = createAdminClient()

  if (args.acceptedByPersonId) {
    const { error: linkExistingError } = await admin
      .from('users')
      .update({
        person_id: args.acceptedByPersonId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.authUserId)

    if (linkExistingError) {
      throw new Error(linkExistingError.message)
    }

    return args.acceptedByPersonId
  }

  const normalizedEmail = normalizeAdminInviteEmail(args.acceptedByEmail)
  if (!normalizedEmail) {
    throw new Error('This invite is missing a valid accepted email address.')
  }

  const { data: currentUser, error: currentUserError } = await admin
    .from('users')
    .select('person_id')
    .eq('id', args.authUserId)
    .maybeSingle<{ person_id: string | null }>()

  if (currentUserError) {
    throw new Error(currentUserError.message)
  }

  if (currentUser?.person_id) {
    return currentUser.person_id
  }

  const { data: matchingPerson, error: matchingPersonError } = await admin
    .from('people')
    .select('id, primary_relationship_code')
    .ilike('email', normalizedEmail)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; primary_relationship_code: string | null }>()

  if (matchingPersonError) {
    throw new Error(matchingPersonError.message)
  }

  const personId = matchingPerson?.id ?? null

  if (personId) {
    const { error: linkMatchedError } = await admin
      .from('users')
      .update({
        person_id: personId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', args.authUserId)

    if (linkMatchedError) {
      throw new Error(linkMatchedError.message)
    }

    return personId
  }

  const { data: newPerson, error: createPersonError } = await admin
    .from('people')
    .insert(protectPeoplePayload({
      ...inferNameParts(args.inviteeName ?? null, normalizedEmail),
      email: normalizedEmail,
      primary_relationship_code: 'non_member',
      local_unit_id: args.councilId ?? null,
      council_id: args.councilId ?? null,
      source_code: 'admin_invite',
    }))
    .select('id')
    .maybeSingle<{ id: string }>()

  if (createPersonError || !newPerson?.id) {
    throw new Error(createPersonError?.message ?? 'We could not create the person record for this accepted invite.')
  }

  const { error: linkNewError } = await admin
    .from('users')
    .update({
      person_id: newPerson.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.authUserId)

  if (linkNewError) {
    throw new Error(linkNewError.message)
  }

  return newPerson.id
}

export async function acceptOrganizationAdminInvitation(args: {
  rawToken: string
  acceptedByAuthUserId: string
  acceptedByEmail: string
  acceptedByPersonId?: string | null
}) {
  const admin = createAdminClient()
  const tokenHash = hashToken(args.rawToken)

  const { data: invitation, error: invitationError } = await admin
    .from('organization_admin_invitations')
    .select('id, organization_id, council_id, invitee_email, invitee_name, status_code, notes, selector, token_hash, expires_at, accepted_assignment_id, accepted_at')
    .eq('token_hash', tokenHash)
    .maybeSingle<InvitationRow>()

  if (invitationError) {
    throw new Error(invitationError.message)
  }

  if (!invitation) {
    throw new Error('Incorrect or expired code. Please resend a verification code and use the shared verification phrase exactly as provided by the person who invited you.')
  }

  const normalizedAcceptedEmail = normalizeAdminInviteEmail(args.acceptedByEmail)
  if (!normalizedAcceptedEmail || normalizedAcceptedEmail !== invitation.invitee_email.toLowerCase()) {
    throw new Error('Only the invited email address can accept this admin invite.')
  }

  if (invitation.status_code === 'accepted' && invitation.accepted_assignment_id) {
    return {
      assignmentId: invitation.accepted_assignment_id,
      organizationId: invitation.organization_id,
      councilId: invitation.council_id,
      statusCode: invitation.status_code,
    }
  }

  if (invitation.status_code !== 'pending' || new Date(invitation.expires_at).getTime() < Date.now()) {
    throw new Error('Incorrect or expired code. Please resend a verification code and use the shared verification phrase exactly as provided by the person who invited you.')
  }

  const acceptedByPersonId = await ensureAcceptedInvitePerson({
    authUserId: args.acceptedByAuthUserId,
    acceptedByPersonId: args.acceptedByPersonId,
    acceptedByEmail: normalizedAcceptedEmail,
    inviteeName: invitation.invitee_name,
    councilId: invitation.council_id,
  })

  const assignment = await saveOrganizationAdminAssignment({
    personId: acceptedByPersonId,
    organizationId: invitation.organization_id,
    actorUserId: args.acceptedByAuthUserId,
    sourceCode: 'admin_invite',
    grantNotes: invitation.notes,
  })

  const { error: updateError } = await admin
    .from('organization_admin_invitations')
    .update({
      status_code: 'accepted',
      accepted_by_auth_user_id: args.acceptedByAuthUserId,
      accepted_assignment_id: assignment.assignmentId,
      accepted_at: new Date().toISOString(),
      updated_by_auth_user_id: args.acceptedByAuthUserId,
    })
    .eq('id', invitation.id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  return {
    assignmentId: assignment.assignmentId,
    organizationId: invitation.organization_id,
    councilId: invitation.council_id,
    statusCode: 'accepted' as const,
  }
}
