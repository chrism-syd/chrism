import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { acceptOrganizationAdminInvitation, getOrganizationAdminInvitationByRawToken } from '@/lib/organizations/admin-invitations'
import { verifyAdminInviteChallenge } from '@/lib/organizations/admin-invite-challenges'

export const dynamic = 'force-dynamic'

function buildRedirectUrl(request: NextRequest, path: string) {
  return new URL(path, request.url)
}

function redirectToInvite(request: NextRequest, rawToken: string, error?: string) {
  const url = buildRedirectUrl(request, '/admin-invite')
  url.searchParams.set('token', rawToken)
  if (error) url.searchParams.set('error', error)
  return NextResponse.redirect(url)
}

function wantsJson(request: NextRequest) {
  return request.headers.get('x-admin-invite-accept') === 'json'
}

function jsonResult(request: NextRequest, redirectTo: string, error?: string) {
  return NextResponse.json({ redirectTo, error }, { status: error ? 400 : 200 })
}

async function formText(request: NextRequest, key: string) {
  if (request.method !== 'POST') return null

  const formData = await request.formData()
  const value = formData.get(key)
  return typeof value === 'string' ? value : null
}

async function handleAccept(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawToken = searchParams.get('token')?.trim() ?? ''
  const invitationId = searchParams.get('invitation_id')?.trim() ?? ''
  const challengeResponse = await formText(request, 'challenge_response')

  if (!rawToken) {
    const redirectTo = '/admin-invite/invalid?reason=missing'
    return wantsJson(request)
      ? jsonResult(request, redirectTo, 'That admin invite could not be found.')
      : NextResponse.redirect(buildRedirectUrl(request, redirectTo))
  }

  if (!invitationId) {
    return wantsJson(request)
      ? jsonResult(request, `/admin-invite?token=${encodeURIComponent(rawToken)}`, 'That admin invite could not be verified.')
      : redirectToInvite(request, rawToken, 'That admin invite could not be verified.')
  }

  const permissions = await getCurrentUserPermissions()

  if (!permissions.authUser) {
    return wantsJson(request)
      ? jsonResult(request, `/admin-invite?token=${encodeURIComponent(rawToken)}`, 'Please verify your invited email address before accepting admin access.')
      : redirectToInvite(request, rawToken, 'Please verify your invited email address before accepting admin access.')
  }

  const invitation = await getOrganizationAdminInvitationByRawToken(rawToken)

  if (!invitation) {
    const redirectTo = `/admin-invite/invalid?reason=missing&token=${encodeURIComponent(rawToken)}`
    return wantsJson(request)
      ? jsonResult(request, redirectTo, 'That admin invite could not be found.')
      : NextResponse.redirect(buildRedirectUrl(request, redirectTo))
  }

  if (invitation.id !== invitationId) {
    return wantsJson(request)
      ? jsonResult(request, `/admin-invite?token=${encodeURIComponent(rawToken)}`, 'That admin invite could not be verified.')
      : redirectToInvite(request, rawToken, 'That admin invite could not be verified.')
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
    const message = error instanceof Error ? error.message : 'We could not accept that invite right now.'
    return wantsJson(request)
      ? jsonResult(request, `/admin-invite?token=${encodeURIComponent(rawToken)}`, message)
      : redirectToInvite(request, rawToken, message)
  }

  const redirectTo = '/me/council?notice=Admin invite accepted.'
  return wantsJson(request)
    ? jsonResult(request, redirectTo)
    : NextResponse.redirect(buildRedirectUrl(request, redirectTo))
}

export async function GET(request: NextRequest) {
  return handleAccept(request)
}

export async function POST(request: NextRequest) {
  return handleAccept(request)
}
