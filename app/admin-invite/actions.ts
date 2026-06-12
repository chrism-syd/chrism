'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { acceptOrganizationAdminInvitation, getOrganizationAdminInvitationByRawToken } from '@/lib/organizations/admin-invitations'
import { verifyAdminInviteChallenge } from '@/lib/organizations/admin-invite-challenges'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'

function redirectToInvite(rawToken: string, error?: string | null, notice?: string | null): never {
  const params = new URLSearchParams()
  params.set('token', rawToken)
  if (error) params.set('error', error)
  if (notice) params.set('notice', notice)
  redirect(`/admin-invite?${params.toString()}`)
}

export async function acceptAdminInvitationAction(formData: FormData) {
  const rawToken = String(formData.get('token') ?? '')
  const invitationId = String(formData.get('invitation_id') ?? '')
  const challengeResponse = String(formData.get('challenge_response') ?? '')
  const permissions = await getCurrentUserPermissions()

  if (!permissions.authUser) {
    redirectToInvite(rawToken, 'Please verify your invited email address before accepting admin access.')
  }

  const invitation = await getOrganizationAdminInvitationByRawToken(rawToken)

  if (!invitation) {
    redirect('/me?error=That admin invite could not be found.')
  }

  if (invitation.id !== invitationId) {
    redirectToInvite(rawToken, 'That admin invite could not be verified.')
  }

  try {
    await verifyAdminInviteChallenge({
      invitationId,
      rawToken,
      challenge: challengeResponse,
    })

    const acceptance = await acceptOrganizationAdminInvitation({
      invitationId,
      rawToken,
      acceptedByAuthUserId: permissions.authUser.id,
      acceptedByPersonId: permissions.personId,
      acceptedByEmail: permissions.email ?? '',
    })

    revalidatePath('/me')
    revalidatePath('/me/council')
    if (acceptance.personId) {
      revalidatePath(`/me/council/admins/${acceptance.personId}`)
    }
  } catch (error) {
    redirectToInvite(rawToken, error instanceof Error ? error.message : 'We could not accept that invite right now.')
  }

  redirect('/me/council?notice=Admin invite accepted.')
}
