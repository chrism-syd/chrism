import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { acceptOrganizationAdminInvitation, getOrganizationAdminInvitationByRawToken } from '@/lib/organizations/admin-invitations'

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

async function handleAccept(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawToken = searchParams.get('token')?.trim() ?? ''
  const invitationId = searchParams.get('invitation_id')?.trim() ?? ''

  if (!rawToken) {
    return NextResponse.redirect(buildRedirectUrl(request, '/admin-invite/invalid?reason=missing'))
  }

  if (!invitationId) {
    return redirectToInvite(request, rawToken, 'That admin invite could not be verified.')
  }

  const permissions = await getCurrentUserPermissions()

  if (!permissions.authUser) {
    return redirectToInvite(request, rawToken, 'Please verify your invited email address before accepting admin access.')
  }

  const invitation = await getOrganizationAdminInvitationByRawToken(rawToken)

  if (!invitation) {
    return NextResponse.redirect(buildRedirectUrl(request, `/admin-invite/invalid?reason=missing&token=${encodeURIComponent(rawToken)}`))
  }

  if (invitation.id !== invitationId) {
    return redirectToInvite(request, rawToken, 'That admin invite could not be verified.')
  }

  try {
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
    return redirectToInvite(
      request,
      rawToken,
      error instanceof Error ? error.message : 'We could not accept that invite right now.'
    )
  }

  return NextResponse.redirect(buildRedirectUrl(request, '/me/council?notice=Admin invite accepted.'))
}

export async function GET(request: NextRequest) {
  return handleAccept(request)
}

export async function POST(request: NextRequest) {
  return handleAccept(request)
}
