'use server'

import { headers } from 'next/headers'
import { setFlashMessage } from '@/lib/flash-messages'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { isParallelAreaAccessEnabled } from '@/lib/auth/feature-flags'
import {
  normalizeAdminGrantEmail,
  saveOrganizationAdminAssignment,
} from '@/lib/organizations/admin-assignments'
import { saveAdminInviteChallenge, normalizeAdminInviteChallenge } from '@/lib/organizations/admin-invite-challenges'
import {
  createOrganizationAdminInvitation,
  normalizeAdminInviteEmail,
  normalizeAdminInviteText,
  revokeOrganizationAdminInvitation,
  sendOrganizationAdminInvitationEmail,
} from '@/lib/organizations/admin-invitations'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  formatOfficerLabel,
  getOfficerRoleOption,
  isAutomaticCouncilAdminTerm,
  type OfficerScopeCode,
  isOfficerTermActive,
} from '@/lib/members/officer-roles'
import { listValidMemberPersonIdsForLocalUnit } from '@/lib/custom-lists'

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

async function redirectToCouncilPage(args: { error?: string | null; notice?: string | null }): Promise<never> {
  if (args.error) {
    await setFlashMessage('error', args.error)
  } else if (args.notice) {
    await setFlashMessage('notice')
  }

  redirect('/me/council')
}

function metadataString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getInviteSenderNameFromMetadata(userMetadata: Record<string, unknown> | undefined) {
  if (!userMetadata) return null

  return (
    metadataString(userMetadata.full_name) ??
    metadataString(userMetadata.name) ??
    metadataString(userMetadata.display_name) ??
    metadataString(userMetadata.given_name)
  )
}

async function requireOrganizationSettingsAccess() {
  const context = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/me',
    areaCode: 'local_unit_settings',
    minimumAccessLevel: 'manage',
  })

  if (!context.permissions.organizationId || !context.permissions.canAccessOrganizationSettings) {
    redirect('/me')
  }

  return context
}

async function requireOrganizationAdminManager() {
  if (isParallelAreaAccessEnabled({ areaCode: 'admins', minimumAccessLevel: 'manage' })) {
    const adminContext = await getCurrentActingCouncilContext({
      requireAdmin: true,
      redirectTo: '/me/council',
      areaCode: 'admins',
      minimumAccessLevel: 'manage',
    })

    if (!adminContext.permissions.organizationId || !adminContext.permissions.canManageAdmins) {
      return await redirectToCouncilPage({
        error: 'Only the current Grand Knight, Financial Secretary, or super admin can manage manual admin access.',
      })
    }

    return adminContext
  }

  const context = await requireOrganizationSettingsAccess()

  if (!context.permissions.canManageAdmins) {
    return await redirectToCouncilPage({
      error: 'Only the current Grand Knight, Financial Secretary, or super admin can manage manual admin access.',
    })
  }

  return context
}

async function requireActiveLocalUnitMemberSelection(args: {
  admin: ReturnType<typeof createAdminClient>
  localUnitId: string | null
  personId: string
  errorMessage: string
}) {
  if (!args.localUnitId) {
    return await redirectToCouncilPage({
      error: 'This view is missing its active local organization context. Refresh and try again.',
    })
  }

  const validPersonIds = await listValidMemberPersonIdsForLocalUnit({
    admin: args.admin,
    localUnitId: args.localUnitId,
    personIds: [args.personId],
  })

  if (!validPersonIds.includes(args.personId)) {
    return await redirectToCouncilPage({ error: args.errorMessage })
  }
}

function buildAbsoluteInviteUrl(args: { origin: string | null; invitePath: string }) {
  if (!args.origin) {
    return args.invitePath
  }

  try {
    return new URL(args.invitePath, args.origin).toString()
  } catch {
    return args.invitePath
  }
}

async function saveOfficerRoleEmail(args: {
  localUnitId: string
  officeScopeCode: string
  officeCode: string
  officeRank: number | null
  email: string | null
  authUserId: string
}) {
  const admin = createAdminClient()
  const existingQuery = admin
    .from('officer_role_emails')
    .select('id')
    .eq('local_unit_id', args.localUnitId)
    .eq('office_scope_code', args.officeScopeCode)
    .eq('office_code', args.officeCode)
    .eq('is_active', true)

  const { data: existingRecord, error: existingError } = await (args.officeRank == null
    ? existingQuery.is('office_rank', null)
    : existingQuery.eq('office_rank', args.officeRank)
  ).maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (!args.email) {
    if (existingRecord?.id) {
      const { error } = await admin
        .from('officer_role_emails')
        .delete()
        .eq('id', existingRecord.id)
        .eq('local_unit_id', args.localUnitId)

      if (error) {
        throw new Error(error.message)
      }
    }
    return
  }

  const payload = {
    local_unit_id: args.localUnitId,
    office_scope_code: args.officeScopeCode,
    office_code: args.officeCode,
    office_rank: args.officeRank,
    email: args.email,
    login_enabled: true,
    is_active: true,
    created_by_auth_user_id: args.authUserId,
    updated_by_auth_user_id: args.authUserId,
  }

  const mutation = existingRecord?.id
    ? admin.from('officer_role_emails').update(payload).eq('id', existingRecord.id)
    : admin.from('officer_role_emails').insert(payload)

  const { error } = await mutation

  if (error) {
    throw new Error(error.message)
  }
}

async function personStillHasAutomaticAdmin(args: {
  admin: ReturnType<typeof createAdminClient>
  localUnitId: string
  personId: string
  excludeTermId?: string | null
}) {
  const query = args.admin
    .from('person_officer_terms')
    .select('id, person_id, office_scope_code, office_code, office_rank, service_start_year, service_end_year, manual_end_effective_date, notes')
    .eq('local_unit_id', args.localUnitId)
    .eq('person_id', args.personId)

  const { data, error } = await (args.excludeTermId
    ? query.neq('id', args.excludeTermId)
    : query).returns<Array<{
      id: string
      office_scope_code: string
      office_code: string
      office_rank: number | null
      service_start_year: number
      service_end_year: number | null
      manual_end_effective_date?: string | null
      notes: string | null
    }>>()

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as Array<{
    id: string
    office_scope_code: string
    office_code: string
    office_rank: number | null
    service_start_year: number
    service_end_year: number | null
    notes: string | null
  }>).some((term) =>
    isOfficerTermActive({ ...term, office_label: '' }, { useKnightsOfColumbusFraternalYear: true }) &&
    isAutomaticCouncilAdminTerm({
      office_scope_code: term.office_scope_code as OfficerScopeCode,
      office_code: term.office_code,
    })
  )
}

function revalidateCouncilSurfaces() {
  revalidatePath('/')
  revalidatePath('/me')
  revalidatePath('/me/council')
  revalidatePath('/me/claim-organization')
  revalidatePath('/people/officers')
  revalidatePath('/super-admin/organization-claims')
}

function rangesOverlap(
  left: { start: number; end: number | null },
  right: { start: number; end: number | null }
) {
  const leftEnd = left.end ?? Number.POSITIVE_INFINITY
  const rightEnd = right.end ?? Number.POSITIVE_INFINITY

  return left.start <= rightEnd && right.start <= leftEnd
}

function revalidateOfficerSurfaces(personId: string | null) {
  revalidateCouncilSurfaces()
  revalidatePath('/people')

  if (personId) {
    revalidatePath(`/people/${personId}`)
    revalidatePath(`/people/${personId}/edit`)
    revalidatePath(`/people/${personId}/officers`)
  }
}

export async function saveOfficerRoleEmailAction(formData: FormData) {
  const context = await requireOrganizationSettingsAccess()
  const termId = textValue(formData, 'term_id')
  const email = normalizeAdminGrantEmail(textValue(formData, 'official_email'))

  if (!termId) {
    return await redirectToCouncilPage({ error: 'We could not tell which officer email to save.' })
  }

  if (!context.localUnitId) {
    return await redirectToCouncilPage({ error: 'This view is missing its active local organization context. Refresh and try again.' })
  }

  const admin = createAdminClient()
  const { data: term, error: termError } = await admin
    .from('person_officer_terms')
    .select('id, person_id, office_scope_code, office_code, office_rank')
    .eq('id', termId)
    .eq('local_unit_id', context.localUnitId)
    .maybeSingle()

  if (termError) {
    return await redirectToCouncilPage({ error: termError.message })
  }

  if (!term) {
    return await redirectToCouncilPage({ error: 'That officer term could not be found.' })
  }

  try {
    await saveOfficerRoleEmail({
      localUnitId: context.localUnitId,
      officeScopeCode: term.office_scope_code,
      officeCode: term.office_code,
      officeRank: term.office_rank ?? null,
      email,
      authUserId: context.permissions.authUser!.id,
    })
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'We could not save the officer email.'
    return await redirectToCouncilPage({ error: message })
  }

  revalidateOfficerSurfaces(term.person_id)
  return await redirectToCouncilPage({ notice: email ? 'Officer email saved.' : 'Officer email cleared.' })
}

export async function updateCouncilDetailsAction(formData: FormData) {
  const context = await requireOrganizationSettingsAccess()
  const displayName = textValue(formData, 'display_name')
  const preferredName = textValue(formData, 'preferred_name')

  if (!displayName) {
    return await redirectToCouncilPage({ error: 'Please enter the formal organization name before saving.' })
  }

  const admin = createAdminClient()
  const { error: organizationError } = await admin
    .from('organizations')
    .update({
      display_name: displayName,
      preferred_name: preferredName,
    })
    .eq('id', context.permissions.organizationId!)

  if (organizationError) {
    return await redirectToCouncilPage({ error: organizationError.message })
  }

  const councilName = preferredName ?? displayName

  const { error: councilUpdateError } = await admin
    .from('councils')
    .update({ name: councilName })
    .eq('id', context.council.id)

  if (councilUpdateError) {
    return await redirectToCouncilPage({ error: councilUpdateError.message })
  }

  revalidateCouncilSurfaces()
  return await redirectToCouncilPage({ notice: 'Organization details saved.' })
}

export async function grantCouncilAdminAction(formData: FormData) {
  const context = await requireOrganizationAdminManager()
  const personId = textValue(formData, 'person_id')
  const grantNotes = textValue(formData, 'grant_notes')

  if (!personId) {
    return await redirectToCouncilPage({ error: 'Choose a member before granting admin access.' })
  }

  const admin = createAdminClient()

  await requireActiveLocalUnitMemberSelection({
    admin,
    localUnitId: context.localUnitId,
    personId,
    errorMessage: 'Choose an active local-unit member before granting admin access.',
  })

  try {
    await saveOrganizationAdminAssignment({
      personId,
      organizationId: context.permissions.organizationId!,
      actorUserId: context.permissions.authUser!.id,
      sourceCode: 'manual_assignment',
      grantNotes,
    })
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'We could not grant admin access right now.'
    return await redirectToCouncilPage({ error: message })
  }

  revalidateCouncilSurfaces()
  return await redirectToCouncilPage({ notice: 'Manual admin access saved.' })
}

export async function inviteCouncilAdminByEmailAction(formData: FormData) {
  const context = await requireOrganizationAdminManager()
  const inviteeName = normalizeAdminInviteText(textValue(formData, 'invitee_name'))
  const inviteEmail = normalizeAdminInviteEmail(textValue(formData, 'grantee_email'))
  const grantNotes = normalizeAdminInviteText(textValue(formData, 'grant_notes'))
  const sharedPhrase = normalizeAdminInviteChallenge(textValue(formData, 'shared_verification_phrase'))
  const confirmedSensitiveAccess = formData.get('confirm_sensitive_admin_invite') === 'true'
  const inviterName = getInviteSenderNameFromMetadata(context.permissions.authUser?.user_metadata)

  if (!inviteEmail) {
    return await redirectToCouncilPage({ error: 'Enter an email address before sending the admin invite.' })
  }

  if (!sharedPhrase) {
    return await redirectToCouncilPage({ error: 'Enter a shared verification phrase with at least 4 characters.' })
  }

  if (!confirmedSensitiveAccess) {
    return await redirectToCouncilPage({ error: 'Confirm that the invitee name and email are correct before sending admin access.' })
  }

  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host')
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http'
  const origin = host ? `${protocol}://${host}` : null

  try {
    const invitation = await createOrganizationAdminInvitation({
      organizationId: context.permissions.organizationId!,
      councilId: context.council.id,
      invitedByAuthUserId: context.permissions.authUser!.id,
      inviteeEmail: inviteEmail,
      inviteeName,
      notes: grantNotes,
    })

    await saveAdminInviteChallenge({
      invitationId: invitation.invitationId,
      rawToken: invitation.rawToken,
      challenge: sharedPhrase,
      actorUserId: context.permissions.authUser!.id,
    })

    try {
      await sendOrganizationAdminInvitationEmail({
        inviteeEmail: inviteEmail,
        inviteeName,
        invitePath: invitation.invitePath,
        organizationName: context.council.name ?? context.permissions.organizationName ?? 'this organization',
        councilName: context.council.name,
        councilNumber: context.council.council_number,
        inviterName,
        notes: grantNotes,
        origin,
      })
    } catch (error) {
      if (isRedirectError(error)) {
        throw error
      }
      const message =
        error instanceof Error ? error.message : 'The invite record was created, but the email could not be sent.'
      const manualLink = buildAbsoluteInviteUrl({
        origin,
        invitePath: invitation.invitePath,
      })

      revalidateCouncilSurfaces()
      return await redirectToCouncilPage({
        notice:
          `Admin invite record created for ${inviteEmail}, but the email send failed: ${message}. ` +
          `Use this secure invite link to test or deliver manually right now: ${manualLink}. ` +
          'Share the verification phrase with the invitee separately.',
      })
    }
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'We could not send that admin invite right now.'
    return await redirectToCouncilPage({ error: message })
  }

  revalidateCouncilSurfaces()
  return await redirectToCouncilPage({ notice: `Admin invite sent to ${inviteEmail}. Share the verification phrase with the invitee separately.` })
}

export async function revokeCouncilAdminInvitationAction(formData: FormData) {
  const context = await requireOrganizationAdminManager()
  const invitationId = textValue(formData, 'invitation_id')

  if (!invitationId) {
    return await redirectToCouncilPage({ error: 'We could not tell which invite to revoke.' })
  }

  try {
    await revokeOrganizationAdminInvitation({
      invitationId,
      organizationId: context.permissions.organizationId!,
      revokedByAuthUserId: context.permissions.authUser!.id,
    })
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'We could not revoke that invite right now.'
    return await redirectToCouncilPage({ error: message })
  }

  revalidateCouncilSurfaces()
  return await redirectToCouncilPage({ notice: 'Admin invite revoked.' })
}

export async function revokeCouncilAdminAction(formData: FormData) {
  const context = await requireOrganizationAdminManager()
  const assignmentId = textValue(formData, 'assignment_id')
  const assignmentTable = textValue(formData, 'assignment_table')
  const personId = textValue(formData, 'person_id')

  if (!assignmentId) {
    return await redirectToCouncilPage({ error: 'We could not tell which admin assignment to remove.' })
  }

  let revokeNotice = 'Manual admin access removed.'

  if (personId) {
    if (!context.localUnitId) {
      return await redirectToCouncilPage({ error: 'This view is missing its active local organization context. Refresh and try again.' })
    }

    const admin = createAdminClient()
    const stillAutomatic = await personStillHasAutomaticAdmin({
      admin,
      localUnitId: context.localUnitId,
      personId,
    })

    if (stillAutomatic) {
      revokeNotice = 'Manual admin access removed. Officer-derived admin access remains active.'
    }
  }

  try {
    if (assignmentTable === 'council') {
      const admin = createAdminClient()
      const { error } = await admin
        .from('council_admin_assignments')
        .update({
          is_active: false,
          updated_by_user_id: context.permissions.authUser!.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignmentId)
        .eq('council_id', context.council.id)

      if (error) {
        throw new Error(error.message)
      }
    } else {
      const admin = createAdminClient()
      const nowIso = new Date().toISOString()

      const { data: existingAssignment, error: lookupError } = await admin
        .from('organization_admin_assignments')
        .select('id, organization_id')
        .eq('id', assignmentId)
        .maybeSingle<{ id: string; organization_id: string }>()

      if (lookupError) {
        throw new Error(lookupError.message)
      }

      if (!existingAssignment) {
        throw new Error('That organization admin assignment could not be found.')
      }

      const { data: updatedRows, error } = await admin
        .from('organization_admin_assignments')
        .update({
          is_active: false,
          revoked_at: nowIso,
          revoked_by_user_id: context.permissions.authUser!.id,
          revoked_notes: null,
          updated_by_user_id: context.permissions.authUser!.id,
          updated_at: nowIso,
        })
        .eq('id', assignmentId)
        .eq('organization_id', existingAssignment.organization_id)
        .select('id, is_active, revoked_at, updated_at')

      if (error) {
        throw new Error(error.message)
      }

      if (!updatedRows || updatedRows.length === 0) {
        throw new Error('No matching organization admin assignment was updated.')
      }
    }
  } catch (error) {
    if (isRedirectError(error)) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'We could not remove that admin access right now.'
    return await redirectToCouncilPage({ error: message })
  }

  revalidateCouncilSurfaces()
  return await redirectToCouncilPage({ notice: revokeNotice })
}

export async function addOfficerTermAction(formData: FormData) {
  const context = await requireOrganizationSettingsAccess()
  const personId = textValue(formData, 'person_id')
  const roleKey = textValue(formData, 'role_key')
  let officeScopeCode = textValue(formData, 'office_scope_code') as OfficerScopeCode | null
  let officeCode = textValue(formData, 'office_code')
  const startYearValue = textValue(formData, 'service_start_year')
  const endYearValue = textValue(formData, 'service_end_year')
  const rankValue = textValue(formData, 'office_rank')
  const grantAdmin = textValue(formData, 'grant_admin') === 'true'
  const officialEmail = normalizeAdminGrantEmail(textValue(formData, 'official_email'))

  if ((!officeScopeCode || !officeCode) && roleKey) {
    const [derivedScope, derivedCode] = roleKey.split(':')
    officeScopeCode = (derivedScope || null) as OfficerScopeCode | null
    officeCode = derivedCode || null
  }

  if (!personId || !officeScopeCode || !officeCode || !startYearValue) {
    return await redirectToCouncilPage({ error: 'Please choose the member, office, and start year before saving this officer term.' })
  }

  if (!context.localUnitId) {
    return await redirectToCouncilPage({ error: 'This view is missing its active local organization context. Refresh and try again.' })
  }

  const resolvedPersonId = personId as string
  const resolvedOfficeScopeCode = officeScopeCode as OfficerScopeCode
  const resolvedOfficeCode = officeCode as string
  const startYear = Number(startYearValue)
  const endYear =
    endYearValue && endYearValue.toLowerCase() !== 'current'
      ? Number(endYearValue)
      : null
  const rank = rankValue ? Number(rankValue) : null
  const option = getOfficerRoleOption(resolvedOfficeScopeCode, resolvedOfficeCode)

  if (!Number.isFinite(startYear)) {
    return await redirectToCouncilPage({ error: 'Enter a valid start year before saving this officer term.' })
  }

  if (!option) {
    return await redirectToCouncilPage({ error: 'Choose a valid officer role before saving.' })
  }

  const label = formatOfficerLabel({
    office_scope_code: resolvedOfficeScopeCode,
    office_code: resolvedOfficeCode,
    office_rank: rank,
    office_label: option.label,
  })

  const termPayload = {
    local_unit_id: context.localUnitId,
    person_id: resolvedPersonId,
    office_scope_code: resolvedOfficeScopeCode,
    office_code: resolvedOfficeCode,
    office_rank: rank,
    office_label: label,
    service_start_year: startYear,
    service_end_year: endYear,
    manual_end_effective_date: null,
    notes: textValue(formData, 'notes'),
    created_by_auth_user_id: context.permissions.authUser!.id,
    updated_by_auth_user_id: context.permissions.authUser!.id,
  }

  const admin = createAdminClient()

  await requireActiveLocalUnitMemberSelection({
    admin,
    localUnitId: context.localUnitId,
    personId: resolvedPersonId,
    errorMessage: 'Choose an active local-unit member before adding an officer role.',
  })

  const existingQuery = admin
    .from('person_officer_terms')
    .select('id, service_start_year, service_end_year, manual_end_effective_date')
    .eq('person_id', resolvedPersonId)
    .eq('local_unit_id', context.localUnitId)
    .eq('office_scope_code', resolvedOfficeScopeCode)
    .eq('office_code', resolvedOfficeCode)

  const existingTerms = (await existingQuery).data as Array<{
    id: string
    service_start_year: number
    service_end_year: number | null
    manual_end_effective_date?: string | null
  }> | null

  const conflictingTerm = (existingTerms ?? []).find((term) => {
    const existingEndYear = term.service_end_year ?? null
    return rangesOverlap({ start: term.service_start_year, end: existingEndYear }, { start: startYear, end: endYear })
  })

  if (conflictingTerm) {
    return await redirectToCouncilPage({ error: 'This member already has that officer role for an overlapping service year.' })
  }

  const { error } = await admin
    .from('person_officer_terms')
    .insert(termPayload)
    .select('id')
    .maybeSingle<{ id: string }>()

  if (error) {
    return await redirectToCouncilPage({ error: error.message })
  }

  if (grantAdmin) {
    try {
      await saveOrganizationAdminAssignment({
        personId: resolvedPersonId,
        organizationId: context.permissions.organizationId!,
        actorUserId: context.permissions.authUser!.id,
        sourceCode: 'manual_assignment',
        grantNotes: `Admin access granted while adding officer role: ${label}`,
      })
    } catch (error) {
      if (isRedirectError(error)) {
        throw error
      }
      return await redirectToCouncilPage({
        error: error instanceof Error
          ? `Officer role saved, but admin access could not be granted: ${error.message}`
          : 'Officer role saved, but admin access could not be granted.',
      })
    }
  }

  if (officialEmail) {
    try {
      await saveOfficerRoleEmail({
        localUnitId: context.localUnitId,
        officeScopeCode: resolvedOfficeScopeCode,
        officeCode: resolvedOfficeCode,
        officeRank: option.supportsRank ? rank : null,
        email: officialEmail,
        authUserId: context.permissions.authUser!.id,
      })
    } catch (error) {
      if (isRedirectError(error)) {
        throw error
      }
      return await redirectToCouncilPage({
        error: error instanceof Error
          ? `Officer role saved, but the official officer email could not be saved: ${error.message}`
          : 'Officer role saved, but the official officer email could not be saved.',
      })
    }
  }

  revalidateOfficerSurfaces(resolvedPersonId)
  return await redirectToCouncilPage({ notice: `${label} role added.` })
}

export async function removeOfficerTermAction(formData: FormData) {
  const context = await requireOrganizationSettingsAccess()
  const termId = textValue(formData, 'term_id')

  if (!termId) {
    return await redirectToCouncilPage({ error: 'We could not tell which officer role to remove.' })
  }

  if (!context.localUnitId) {
    return await redirectToCouncilPage({ error: 'This view is missing its active local organization context. Refresh and try again.' })
  }

  const admin = createAdminClient()

  const { data: term, error: termError } = await admin
    .from('person_officer_terms')
    .select('id, person_id, office_scope_code, office_code, office_rank, office_label')
    .eq('id', termId)
    .eq('local_unit_id', context.localUnitId)
    .maybeSingle()

  if (termError) {
    return await redirectToCouncilPage({ error: termError.message })
  }

  if (!term) {
    return await redirectToCouncilPage({ error: 'That officer role could not be found.' })
  }

  const roleLabel = formatOfficerLabel({
    office_scope_code: term.office_scope_code,
    office_code: term.office_code,
    office_rank: term.office_rank ?? null,
    office_label: term.office_label,
  })

  const { error } = await admin
    .from('person_officer_terms')
    .delete()
    .eq('id', termId)
    .eq('local_unit_id', context.localUnitId)

  if (error) {
    return await redirectToCouncilPage({ error: error.message })
  }

  const stillAutomatic = await personStillHasAutomaticAdmin({
    admin,
    localUnitId: context.localUnitId,
    personId: term.person_id,
    excludeTermId: term.id,
  })

  revalidateOfficerSurfaces(term.person_id)
  return await redirectToCouncilPage({
    notice: stillAutomatic
      ? `${roleLabel} role removed. Officer-derived admin access remains active because this member still has another qualifying officer role.`
      : `${roleLabel} role removed.`,
  })
}
