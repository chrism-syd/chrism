import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export function normalizeAdminInviteChallenge(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? ''
  return normalized.length >= 4 ? normalized : null
}

export function buildAdminInviteChallengeHash(rawToken: string, challenge: string | null | undefined) {
  const normalized = normalizeAdminInviteChallenge(challenge)
  if (!normalized) return null
  return createHash('sha256').update(`${rawToken}:${normalized}`).digest('hex')
}

export async function saveAdminInviteChallenge(args: {
  invitationId: string | null
  rawToken: string
  challenge: string | null | undefined
  actorUserId: string
}) {
  if (!args.invitationId) {
    throw new Error('The admin invite was created, but the invite challenge could not be saved.')
  }

  const challengeHash = buildAdminInviteChallengeHash(args.rawToken, args.challenge)
  if (!challengeHash) {
    throw new Error('Enter a shared verification phrase with at least 4 characters.')
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('organization_admin_invitations')
    .update({
      challenge_response_hash: challengeHash,
      updated_by_auth_user_id: args.actorUserId,
    })
    .eq('id', args.invitationId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function verifyAdminInviteChallenge(args: {
  invitationId: string
  rawToken: string
  challenge: string | null | undefined
}) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('organization_admin_invitations')
    .select('challenge_response_hash')
    .eq('id', args.invitationId)
    .maybeSingle<{ challenge_response_hash: string | null }>()

  if (error) {
    throw new Error(error.message)
  }

  const expectedHash = data?.challenge_response_hash ?? null
  if (!expectedHash) return

  const providedHash = buildAdminInviteChallengeHash(args.rawToken, args.challenge)
  if (!providedHash || providedHash !== expectedHash) {
    throw new Error('Enter the shared verification phrase exactly as provided by the person who invited you.')
  }
}
