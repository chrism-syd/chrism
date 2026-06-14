'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { setFlashMessage } from '@/lib/flash-messages'
import { acceptOrganizationAdminInvitation, getOrganizationAdminInvitationByRawToken } from '@/lib/organizations/admin-invitations'
import { verifyAdminInviteChallenge } from '@/lib/organizations/admin-invite-challenges'

function invitePath(rawToken: string) {
  return `/admin-invite?token=${encodeURIComponent(rawToken)}`
}

async function redirectToInvite(rawToken: string, error?: string | null, notice?: string | null): Promise<never> {
  const path = invitePath(rawToken)

  if (error) {
    await setFlashMessage('error', error, path)
  } else if (notice) {
    await setFlashMessage('notice', notice, path)
  }

  redirect(path)
}

export async function acceptAdminInvitationAction(formData: FormData) {
  const rawToken = String(formData.get('token') ?? '')
  const invitationId = String(formData.get('invitation_id') ?? '')
  const challengeResponse = String(formData.get('challenge_response') ?? '')
  const permissions = await getCurrentUserPermissions()

  if (!permissions.authUser) {
    return await redirectToInvite(rawToken, 'Please verify your invited email address before accepting admin access.')
  }

  const invitation = await getOrganizationAdminInvitationByRawToken(rawToken)

  if (!invitation) {
    redirect(`/admin-invite/invalid?reason=missing&token=${encodeURIComponent(rawToken)}`)
  }

  if (invitation.id !== invitationId) {
    return await redirectToInvite(rawToken, 'That admin invite could not be verified.')
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
    return await redirectToInvite(rawToken, error instanceof Error ? error.message : 'We could not accept that invite right now.')
  }

  redirect('/me/council')
}
