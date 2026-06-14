'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import {
  OPERATIONS_SCOPE_COOKIE,
  setSelectedOperationsLocalUnitId,
} from '@/lib/auth/operations-scope-selection'
import { setFlashMessage } from '@/lib/flash-messages'
import { acceptOrganizationAdminInvitation, getOrganizationAdminInvitationByRawToken } from '@/lib/organizations/admin-invitations'
import { verifyAdminInviteChallenge } from '@/lib/organizations/admin-invite-challenges'
import { createAdminClient } from '@/lib/supabase/admin'

const SIGNED_IN_INVITE_PHRASE_ERROR = 'Incorrect shared verification phrase. Please enter the phrase exactly as provided by the person who invited you.'

function invitePath(rawToken: string) {
  return `/admin-invite?token=${encodeURIComponent(rawToken)}`
}

function getSignedInInviteErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'We could not accept that invite right now.'
  }

  const normalizedMessage = error.message.trim().toLowerCase()
  if (
    normalizedMessage.includes('incorrect or expired code')
    || normalizedMessage.includes('shared verification phrase')
    || normalizedMessage.includes('challenge')
  ) {
    return SIGNED_IN_INVITE_PHRASE_ERROR
  }

  return error.message
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

async function resolveInviteLocalUnitId(args: {
  councilId?: string | null
  organizationId?: string | null
}) {
  const admin = createAdminClient()

  if (args.councilId) {
    const { data } = await admin
      .from('local_units')
      .select('id')
      .eq('legacy_council_id', args.councilId)
      .limit(1)
      .maybeSingle<{ id: string }>()

    if (data?.id) return data.id
  }

  if (args.organizationId) {
    const { data } = await admin
      .from('local_units')
      .select('id, local_unit_kind')
      .eq('legacy_organization_id', args.organizationId)
      .order('local_unit_kind', { ascending: true })
      .limit(1)

    const localUnit = (data as Array<{ id: string; local_unit_kind?: string | null }> | null)?.[0] ?? null
    if (localUnit?.id) return localUnit.id
  }

  return null
}

async function setAcceptedInviteLocalUnitScope(args: {
  councilId?: string | null
  organizationId?: string | null
}) {
  const localUnitId = await resolveInviteLocalUnitId(args)
  if (!localUnitId) return

  const cookieStore = await cookies()
  cookieStore.set(
    OPERATIONS_SCOPE_COOKIE,
    setSelectedOperationsLocalUnitId({
      rawCookieValue: cookieStore.get(OPERATIONS_SCOPE_COOKIE)?.value ?? null,
      localUnitId,
    }),
    {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    }
  )
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

    await setAcceptedInviteLocalUnitScope({
      councilId: invitation.council_id,
      organizationId: invitation.organization_id,
    })

    revalidatePath('/me')
    revalidatePath('/me/council')
    revalidatePath('/welcome/admin')
    if (acceptance.personId) {
      revalidatePath(`/me/council/admins/${acceptance.personId}`)
    }
  } catch (error) {
    return await redirectToInvite(rawToken, getSignedInInviteErrorMessage(error))
  }

  redirect('/welcome/admin')
}
