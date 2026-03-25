'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { getOrganizationAdminManagerAccess } from '@/lib/organizations/admin-managers'
import {
  deactivateOrganizationAdminAssignment,
  normalizeAdminGrantEmail,
  saveOrganizationAdminAssignment,
} from '@/lib/organizations/admin-assignments'
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
  type OfficerScopeCode,
} from '@/lib/members/officer-roles'

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function redirectToCouncilPage(args: { error?: string | null; notice?: string | null }): never {
  const params = new URLSearchParams()

  if (args.error) {
    params.set('error', args.error)
  }

  if (args.notice) {
    params.set('notice', args.notice)
  }

  redirect(params.size > 0 ? `/me/council?${params.toString()}` : '/me/council')
}

async function requireCouncilAdmin() {
  const context = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/me',
  })

  if (!context.permissions.organizationId) {
    redirect('/me')
  }

  return context
}

async function requireOrganizationAdminManager() {
  const context = await requireCouncilAdmin()
  const adminManagerAccess = await getOrganizationAdminManagerAccess({
    permissions: context.permissions,
    councilId: context.council.id,
  })

  if (!adminManagerAccess.canManageAdmins) {
    redirectToCouncilPage({
      error: 'Only the current Grand Knight, Financial Secretary, or super admin can manage manual admin access.',
    })
  }

  return context
}

async function saveOfficerRoleEmail(args: {
  councilId: string
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
    .eq('council_id', args.councilId)
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
        .eq('council_id', args.councilId)

      if (error) {
        throw new Error(error.message)
      }
    }
    return
  }

  const payload = {
    council_id: args.councilId,
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

export async function saveOfficerRoleEmailAction(formData: FormData) {
  const context = await requireCouncilAdmin()
  const termId = textValue(formData, 'term_id')
  const email = normalizeAdminGrantEmail(textValue(formData, 'official_email'))

  if (!termId) {
    redirectToCouncilPage({ error: 'We could not tell which officer email to save.' })
  }

  const admin = createAdminClient()
  const { data: term, error: termError } = await admin
    .from('person_officer_terms')
    .select('id, person_id, office_scope_code, office_code, office_rank')
    .eq('id', termId)
    .eq('council_id', context.council.id)
    .maybeSingle()

  if (termError) {
    redirectToCouncilPage({ error: termError.message })
  }

  if (!term) {
    redirectToCouncilPage({ error: 'That officer term could not be found.' })
  }

  try {
    await saveOfficerRoleEmail({
      councilId: context.council.id,
      officeScopeCode: term.office_scope_code,
      officeCode: term.office_code,
      officeRank: term.office_rank ?? null,
      email,
      authUserId: context.permissions.authUser!.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'We could not save the officer email.'
    redirectToCouncilPage({ error: message })
  }

  revalidateOfficerSurfaces(term.person_id)
  redirectToCouncilPage({ notice: email ? 'Officer email saved.' : 'Officer email cleared.' })
}

function revalidateCouncilSurfaces() {
  revalidatePath('/')
  revalidatePath('/me')
  revalidatePath('/me/council')
  revalidatePath('/me/claim-organization')
  revalidatePath('/members/officers')
  revalidatePath('/super-admin/organization-claims')
}

function formatYearRange(startYear: number, endYear: number | null) {
  if (endYear == null || endYear === startYear) {
    return `${startYear}`
  }

  return `${startYear} to ${endYear}`
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
  revalidatePath('/members')

  if (personId) {
    revalidatePath(`/members/${personId}`)
    revalidatePath(`/members/${personId}/edit`)
    revalidatePath(`/members/${personId}/officers`)
  }
}

export async function updateCouncilDetailsAction(formData: FormData) {
  const context = await requireCouncilAdmin()
  const displayName = textValue(formData, 'display_name')
  const preferredName = textValue(formData, 'preferred_name')

  if (!displayName) {
    redirectToCouncilPage({ error: 'Please enter the formal organization name before saving.' })
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
    redirectToCouncilPage({ error: organizationError.message })
  }

  const councilName = preferredName ?? displayName

  const { error: councilUpdateError } = await admin
    .from('councils')
    .update({ name: councilName })
    .eq('id', context.council.id)

  if (councilUpdateError) {
    redirectToCouncilPage({ error: councilUpdateError.message })
  }

  revalidateCouncilSurfaces()
  redirectToCouncilPage({ notice: 'Organization details saved.' })
}

export async function grantCouncilAdminAction(formData: FormData) {
  const context = await requireOrganizationAdminManager()
  const personId = textValue(formData, 'person_id')
  const grantNotes = textValue(formData, 'grant_notes')

  if (!personId) {
    redirectToCouncilPage({ error: 'Choose a member before granting admin access.' })
  }

  try {
    await saveOrganizationAdminAssignment({
      personId,
      organizationId: context.permissions.organizationId!,
      actorUserId: context.permissions.authUser!.id,
      sourceCode: 'manual_assignment',
      grantNotes,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'We could not grant admin access right now.'
    redirectToCouncilPage({ error: message })
  }

  revalidateCouncilSurfaces()
  redirectToCouncilPage({ notice: 'Manual admin access saved.' })
}

export async function inviteCouncilAdminByEmailAction(formData: FormData) {
  const context = await requireOrganizationAdminManager()
  const inviteeName = normalizeAdminInviteText(textValue(formData, 'invitee_name'))
  const inviteEmail = normalizeAdminInviteEmail(textValue(formData, 'grantee_email'))
  const grantNotes = normalizeAdminInviteText(textValue(formData, 'grant_notes'))

  if (!inviteEmail) {
    redirectToCouncilPage({ error: 'Enter an email address before sending the admin invite.' })
  }

  try {
    const invitation = await createOrganizationAdminInvitation({
      organizationId: context.permissions.organizationId!,
      councilId: context.council.id,
      invitedByAuthUserId: context.permissions.authUser!.id,
      inviteeEmail: inviteEmail,
      inviteeName,
      notes: grantNotes,
    })

    const headerStore = await headers()
    const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host')
    const protocol = headerStore.get('x-forwarded-proto') ?? 'http'
    const origin = host ? `${protocol}://${host}` : null

    await sendOrganizationAdminInvitationEmail({
      inviteeEmail: inviteEmail,
      invitePath: invitation.invitePath,
      origin,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'We could not send that admin invite right now.'
    redirectToCouncilPage({ error: message })
  }

  revalidateCouncilSurfaces()
  redirectToCouncilPage({ notice: `Admin invite sent to ${inviteEmail}.` })
}

export async function revokeCouncilAdminInvitationAction(formData: FormData) {
  const context = await requireOrganizationAdminManager()
  const invitationId = textValue(formData, 'invitation_id')

  if (!invitationId) {
    redirectToCouncilPage({ error: 'We could not tell which invite to revoke.' })
  }

  try {
    await revokeOrganizationAdminInvitation({
      invitationId,
      organizationId: context.permissions.organizationId!,
      revokedByAuthUserId: context.permissions.authUser!.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'We could not revoke that invite right now.'
    redirectToCouncilPage({ error: message })
  }

  revalidateCouncilSurfaces()
  redirectToCouncilPage({ notice: 'Admin invite revoked.' })
}

export async function revokeCouncilAdminAction(formData: FormData) {
  const context = await requireOrganizationAdminManager()
  const assignmentId = textValue(formData, 'assignment_id')

  if (!assignmentId) {
    redirectToCouncilPage({ error: 'We could not tell which admin assignment to remove.' })
  }

  try {
    await deactivateOrganizationAdminAssignment({
      assignmentId,
      organizationId: context.permissions.organizationId!,
      actorUserId: context.permissions.authUser!.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'We could not remove that admin access right now.'
    redirectToCouncilPage({ error: message })
  }

  revalidateCouncilSurfaces()
  redirectToCouncilPage({ notice: 'Manual admin access removed.' })
}

export async function addOfficerTermAction(formData: FormData) {
  const context = await requireCouncilAdmin()
  const personId = textValue(formData, 'person_id')
  const roleKey = textValue(formData, 'role_key')
  let officeScopeCode = textValue(formData, 'office_scope_code') as OfficerScopeCode | null
  let officeCode = textValue(formData, 'office_code')

  if ((!officeScopeCode || !officeCode) && roleKey) {
    const [derivedScope, derivedCode] = roleKey.split(':')
    officeScopeCode = (derivedScope || null) as OfficerScopeCode | null
    officeCode = derivedCode || null
  }
  const startYearValue = textValue(formData, 'service_start_year')
  const endYearValue = textValue(formData, 'service_end_year')
  const rankValue = textValue(formData, 'office_rank')
  const grantAdmin = textValue(formData, 'grant_admin') === 'true'
  const officialEmail = normalizeAdminGrantEmail(textValue(formData, 'official_email'))

  if (!personId || !officeScopeCode || !officeCode || !startYearValue) {
    redirectToCouncilPage({ error: 'Please choose the member, office, and start year before saving.' })
  }

  const resolvedPersonId = personId as string
  const resolvedOfficeScopeCode = officeScopeCode as OfficerScopeCode
  const resolvedOfficeCode = officeCode as string
  const startYear = Number(startYearValue)
  const endYear = endYearValue ? Number(endYearValue) : null
  const rank = rankValue ? Number(rankValue) : null
  const option = getOfficerRoleOption(resolvedOfficeScopeCode, resolvedOfficeCode)

  const admin = createAdminClient()

  const { data: existingTerms, error: existingTermsError } = await admin
    .from('person_officer_terms')
    .select('id, office_scope_code, office_code, office_label, office_rank, service_start_year, service_end_year')
    .eq('council_id', context.council.id)
    .eq('person_id', resolvedPersonId)

  if (existingTermsError) {
    redirectToCouncilPage({ error: existingTermsError.message })
  }

  const overlappingTerm = (existingTerms ?? []).find((term) =>
    rangesOverlap(
      { start: startYear, end: endYear },
      { start: term.service_start_year, end: term.service_end_year }
    )
  )

  if (overlappingTerm) {
    const overlappingLabel = formatOfficerLabel(overlappingTerm)
    const overlappingYears = formatYearRange(
      overlappingTerm.service_start_year,
      overlappingTerm.service_end_year
    )

    redirectToCouncilPage({
      error:
        `This member already has an officer term during ${overlappingYears} (${overlappingLabel}). A member can only hold one officer role at a time.`,
    })
  }

  const payload = {
    council_id: context.council.id,
    person_id: resolvedPersonId,
    office_scope_code: resolvedOfficeScopeCode,
    office_code: resolvedOfficeCode,
    office_label: formatOfficerLabel({ scope: resolvedOfficeScopeCode, code: resolvedOfficeCode, rank }),
    office_rank: option?.supportsRank ? rank : null,
    service_start_year: startYear,
    service_end_year: endYear,
    notes: textValue(formData, 'notes'),
    created_by_auth_user_id: context.permissions.authUser!.id,
    updated_by_auth_user_id: context.permissions.authUser!.id,
  }

  const { error } = await admin.from('person_officer_terms').insert(payload)

  if (error) {
    redirectToCouncilPage({ error: error.message })
  }

  try {
    await saveOfficerRoleEmail({
      councilId: context.council.id,
      officeScopeCode: resolvedOfficeScopeCode,
      officeCode: resolvedOfficeCode,
      officeRank: option?.supportsRank ? rank : null,
      email: officialEmail,
      authUserId: context.permissions.authUser!.id,
    })
  } catch (emailError) {
    const message = emailError instanceof Error ? emailError.message : 'Officer term saved, but the office email could not be saved.'
    revalidateCouncilSurfaces()
    redirectToCouncilPage({ error: `Officer term saved. ${message}` })
  }

  if (grantAdmin) {
    try {
      await saveOrganizationAdminAssignment({
        personId: resolvedPersonId,
        organizationId: context.permissions.organizationId!,
        actorUserId: context.permissions.authUser!.id,
        sourceCode: 'manual_assignment',
        grantNotes: 'Granted while saving officer term.',
      })
    } catch (adminError) {
      const message =
        adminError instanceof Error
          ? adminError.message
          : 'The officer term was saved, but admin access could not be granted.'
      revalidateCouncilSurfaces()
      redirectToCouncilPage({ error: `Officer term saved. ${message}` })
    }
  }

  revalidateOfficerSurfaces(resolvedPersonId)
  redirectToCouncilPage({ notice: 'Officer term saved.' })
}

export async function removeOfficerTermAction(formData: FormData) {
  const context = await requireCouncilAdmin()
  const termId = textValue(formData, 'term_id')

  if (!termId) {
    redirectToCouncilPage({ error: 'We could not tell which officer term to end.' })
  }

  const admin = createAdminClient()
  const { data: existingTerm, error: existingTermError } = await admin
    .from('person_officer_terms')
    .select('id, person_id, service_end_year')
    .eq('id', termId)
    .eq('council_id', context.council.id)
    .maybeSingle()

  if (existingTermError) {
    redirectToCouncilPage({ error: existingTermError.message })
  }

  if (!existingTerm) {
    redirectToCouncilPage({ error: 'That officer term could not be found.' })
  }

  if (existingTerm.service_end_year != null) {
    redirectToCouncilPage({ error: 'That officer term has already ended.' })
  }

  const currentYear = new Date().getFullYear()
  const { error } = await admin
    .from('person_officer_terms')
    .update({
      service_end_year: currentYear,
      updated_by_auth_user_id: context.permissions.authUser!.id,
    })
    .eq('id', termId)
    .eq('council_id', context.council.id)

  if (error) {
    redirectToCouncilPage({ error: error.message })
  }

  revalidateOfficerSurfaces(existingTerm.person_id)
  redirectToCouncilPage({ notice: 'Officer term ended.' })
}
