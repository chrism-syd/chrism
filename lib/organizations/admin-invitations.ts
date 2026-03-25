import { createHash, randomBytes } from 'node:crypto'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { buildAuthConfirmRedirectUrl } from '@/lib/auth/redirects'
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

export async function sendOrganizationAdminInvitationEmail(args: {
  inviteeEmail: string
  invitePath: string
  origin?: string | null
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !publishableKey) {
    throw new Error('Missing Supabase public auth environment variables.')
  }

  const client = createSupabaseClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const emailRedirectTo = buildAuthConfirmRedirectUrl(args.origin || getBaseUrl(), args.invitePath)
  const { error } = await client.auth.signInWithOtp({
    email: args.inviteeEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo,
    },
  })

  if (error) {
    throw new Error(error.message)
  }
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
