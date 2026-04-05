'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import {
  createManagedLocalUnit,
  createManagedOrganization,
  removeManagedOrganizationLogo,
  updateManagedOrganization,
  type ManagedLocalUnitKind,
  type ManagedLocalUnitVisibility,
} from '@/lib/organizations/management'
import {
  createOrganizationAdminInvitation,
  normalizeAdminInviteEmail,
  normalizeAdminInviteText,
  sendOrganizationAdminInvitationEmail,
} from '@/lib/organizations/admin-invitations'

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function fileValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (!(value instanceof File)) return null
  return value.size > 0 ? value : null
}

function redirectToOrganizationsPage(args: {
  error?: string | null
  notice?: string | null
}): never {
  const params = new URLSearchParams()
  if (args.error) params.set('error', args.error)
  if (args.notice) params.set('notice', args.notice)
  redirect(params.size > 0 ? `/super-admin/organizations?${params.toString()}` : '/super-admin/organizations')
}

async function requireSuperAdminNormalMode() {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser || !permissions.isSuperAdmin || permissions.actingMode !== 'normal') {
    redirect('/me')
  }
  return permissions
}

function revalidateOrganizationManagementSurfaces() {
  revalidatePath('/')
  revalidatePath('/me')
  revalidatePath('/me/council')
  revalidatePath('/super-admin/organizations')
  revalidatePath('/super-admin/organization-claims')
}

async function maybeSendInitialAdminInvite(args: {
  actorUserId: string
  organizationId: string
  organizationName: string
  councilId?: string | null
  councilName?: string | null
  councilNumber?: string | null
  inviteeEmail?: string | null
  inviteeName?: string | null
  inviteNotes?: string | null
}) {
  const inviteeEmail = normalizeAdminInviteEmail(args.inviteeEmail)
  if (!inviteeEmail) return null

  const invitation = await createOrganizationAdminInvitation({
    organizationId: args.organizationId,
    councilId: args.councilId ?? null,
    invitedByAuthUserId: args.actorUserId,
    inviteeEmail,
    inviteeName: normalizeAdminInviteText(args.inviteeName),
    notes: normalizeAdminInviteText(args.inviteNotes),
  })

  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host')
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http'
  const origin = host ? `${protocol}://${host}` : null

  try {
    await sendOrganizationAdminInvitationEmail({
      inviteeEmail,
      inviteeName: normalizeAdminInviteText(args.inviteeName),
      invitePath: invitation.invitePath,
      organizationName: args.organizationName,
      councilName: args.councilName ?? null,
      councilNumber: args.councilNumber ?? null,
      inviterName: null,
      notes: normalizeAdminInviteText(args.inviteNotes),
      origin,
    })
    return { emailSent: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The organization was created, but the invite email could not be sent.'
    return { emailSent: false, error: message }
  }
}

export async function createOrganizationAction(formData: FormData) {
  const permissions = await requireSuperAdminNormalMode()

  try {
    const result = await createManagedOrganization({
      actorUserId: permissions.authUser!.id,
      displayName: textValue(formData, 'display_name') ?? '',
      preferredName: textValue(formData, 'preferred_name'),
      organizationTypeCode: textValue(formData, 'organization_type_code') ?? '',
      primaryColorHex: textValue(formData, 'primary_color_hex'),
      secondaryColorHex: textValue(formData, 'secondary_color_hex'),
      logoAltText: textValue(formData, 'logo_alt_text'),
      logoFile: fileValue(formData, 'logo_file'),
      firstLocalUnitKind: (textValue(formData, 'first_local_unit_kind') ?? 'council') as ManagedLocalUnitKind,
      firstLocalUnitDisplayName: textValue(formData, 'first_local_unit_display_name') ?? '',
      firstLocalUnitOfficialName: textValue(formData, 'first_local_unit_official_name'),
      firstLocalUnitVisibility: (textValue(formData, 'first_local_unit_visibility') ?? 'private') as ManagedLocalUnitVisibility,
      firstCouncilNumber: textValue(formData, 'first_council_number'),
      firstCouncilTimezone: textValue(formData, 'first_council_timezone'),
    })

    const inviteResult = await maybeSendInitialAdminInvite({
      actorUserId: permissions.authUser!.id,
      organizationId: result.organizationId,
      organizationName: result.organizationName,
      councilId: result.councilId,
      councilName: textValue(formData, 'first_local_unit_display_name'),
      councilNumber: textValue(formData, 'first_council_number'),
      inviteeEmail: textValue(formData, 'initial_admin_email'),
      inviteeName: textValue(formData, 'initial_admin_name'),
      inviteNotes: textValue(formData, 'initial_admin_notes'),
    })

    revalidateOrganizationManagementSurfaces()

    if (inviteResult && !inviteResult.emailSent) {
      redirectToOrganizationsPage({
        notice: `${result.organizationName} was created. The admin invite record was saved, but the email send failed: ${inviteResult.error}`,
      })
    }

    redirectToOrganizationsPage({
      notice: textValue(formData, 'initial_admin_email')
        ? `${result.organizationName} was created and the initial admin invite was sent.`
        : `${result.organizationName} was created.`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create the organization right now.'
    redirectToOrganizationsPage({ error: message })
  }
}

export async function updateOrganizationAction(formData: FormData) {
  const permissions = await requireSuperAdminNormalMode()
  const organizationId = textValue(formData, 'organization_id')
  if (!organizationId) {
    redirectToOrganizationsPage({ error: 'We could not tell which organization to update.' })
  }

  try {
    await updateManagedOrganization({
      actorUserId: permissions.authUser!.id,
      organizationId,
      displayName: textValue(formData, 'display_name') ?? '',
      preferredName: textValue(formData, 'preferred_name'),
      organizationTypeCode: textValue(formData, 'organization_type_code') ?? '',
      primaryColorHex: textValue(formData, 'primary_color_hex'),
      secondaryColorHex: textValue(formData, 'secondary_color_hex'),
      logoAltText: textValue(formData, 'logo_alt_text'),
      logoFile: fileValue(formData, 'logo_file'),
    })

    const inviteResult = await maybeSendInitialAdminInvite({
      actorUserId: permissions.authUser!.id,
      organizationId,
      organizationName: textValue(formData, 'preferred_name') ?? textValue(formData, 'display_name') ?? 'Organization',
      councilId: textValue(formData, 'invite_council_id'),
      councilName: textValue(formData, 'invite_council_name'),
      councilNumber: textValue(formData, 'invite_council_number'),
      inviteeEmail: textValue(formData, 'initial_admin_email'),
      inviteeName: textValue(formData, 'initial_admin_name'),
      inviteNotes: textValue(formData, 'initial_admin_notes'),
    })

    revalidateOrganizationManagementSurfaces()

    if (inviteResult && !inviteResult.emailSent) {
      redirectToOrganizationsPage({
        notice: `Organization details saved. The admin invite record was created, but the email send failed: ${inviteResult.error}`,
      })
    }

    redirectToOrganizationsPage({
      notice: textValue(formData, 'initial_admin_email')
        ? 'Organization details saved and the admin invite was sent.'
        : 'Organization details saved.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update the organization right now.'
    redirectToOrganizationsPage({ error: message })
  }
}

export async function createLocalUnitAction(formData: FormData) {
  const permissions = await requireSuperAdminNormalMode()
  const organizationId = textValue(formData, 'organization_id')
  const organizationName = textValue(formData, 'organization_name')

  if (!organizationId || !organizationName) {
    redirectToOrganizationsPage({ error: 'We could not tell which organization should own that local unit.' })
  }

  try {
    const result = await createManagedLocalUnit({
      actorUserId: permissions.authUser!.id,
      organizationId,
      organizationDisplayName: organizationName,
      localUnitKind: (textValue(formData, 'local_unit_kind') ?? 'council') as ManagedLocalUnitKind,
      displayName: textValue(formData, 'display_name') ?? '',
      officialName: textValue(formData, 'official_name'),
      visibility: (textValue(formData, 'visibility') ?? 'private') as ManagedLocalUnitVisibility,
      councilNumber: textValue(formData, 'council_number'),
      timezone: textValue(formData, 'timezone'),
    })

    const inviteResult = await maybeSendInitialAdminInvite({
      actorUserId: permissions.authUser!.id,
      organizationId,
      organizationName,
      councilId: result.councilId,
      councilName: textValue(formData, 'display_name'),
      councilNumber: textValue(formData, 'council_number'),
      inviteeEmail: textValue(formData, 'initial_admin_email'),
      inviteeName: textValue(formData, 'initial_admin_name'),
      inviteNotes: textValue(formData, 'initial_admin_notes'),
    })

    revalidateOrganizationManagementSurfaces()

    if (inviteResult && !inviteResult.emailSent) {
      redirectToOrganizationsPage({
        notice: `The local unit was created. The admin invite record was saved, but the email send failed: ${inviteResult.error}`,
      })
    }

    redirectToOrganizationsPage({
      notice: textValue(formData, 'initial_admin_email')
        ? 'Local unit created and admin invite sent.'
        : 'Local unit created.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create the local unit right now.'
    redirectToOrganizationsPage({ error: message })
  }
}

export async function removeOrganizationLogoAction(formData: FormData) {
  const permissions = await requireSuperAdminNormalMode()
  const organizationId = textValue(formData, 'organization_id')
  if (!organizationId) {
    redirectToOrganizationsPage({ error: 'We could not tell which organization logo to remove.' })
  }

  try {
    await removeManagedOrganizationLogo({
      actorUserId: permissions.authUser!.id,
      organizationId,
    })

    revalidateOrganizationManagementSurfaces()
    redirectToOrganizationsPage({ notice: 'Local organization logo removed. Brand fallback will now be used.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not remove the organization logo right now.'
    redirectToOrganizationsPage({ error: message })
  }
}
