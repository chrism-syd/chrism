'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendOrganizationClaimReviewEmail } from '@/lib/email/organization-claim-review'
import { normalizeClaimEmail, normalizeClaimText } from '@/lib/organizations/claim-requests'
import { saveOrganizationAdminAssignment } from '@/lib/organizations/admin-assignments'

function redirectToQueue(args: { error?: string | null }): never {
  const params = new URLSearchParams()
  if (args.error) params.set('error', args.error)
  redirect(params.size > 0 ? `/super-admin/organization-claims?${params.toString()}` : '/super-admin/organization-claims')
}

async function requireSuperAdmin() {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser || !permissions.isSuperAdmin) {
    redirect('/me')
  }
  return permissions
}

function buildCouncilLabel(claim: {
  requested_council_name?: string | null
  requested_council_number?: string | null
  requested_city?: string | null
}) {
  if (claim.requested_council_name && claim.requested_council_number) {
    return `${claim.requested_council_name} (${claim.requested_council_number})`
  }
  return claim.requested_council_name ?? claim.requested_council_number ?? claim.requested_city ?? null
}

export async function approveOrganizationClaimAction(formData: FormData) {
  const permissions = await requireSuperAdmin()
  const claimId = normalizeClaimText(formData.get('claim_id') as string | null)
  const reviewNotes = normalizeClaimText(formData.get('review_notes') as string | null)

  if (!claimId) redirectToQueue({ error: 'Missing claim id for approval.' })

  const admin = createAdminClient()
  const { data: claim, error: claimError } = await admin
    .from('organization_claim_requests')
    .select('id, organization_id, council_id, requested_by_auth_user_id, requested_by_person_id, requester_name, requester_email, requested_council_name, requested_council_number, requested_city, status_code')
    .eq('id', claimId)
    .maybeSingle()

  if (claimError) redirectToQueue({ error: claimError.message })
  if (!claim) redirectToQueue({ error: 'Claim request not found.' })
  if (claim.status_code !== 'pending') redirectToQueue({ error: 'That claim is no longer pending.' })

  const { data: councilContext, error: councilContextError } = claim.council_id
    ? await admin.from('councils').select('organization_id').eq('id', claim.council_id).maybeSingle()
    : { data: null, error: null }

  if (councilContextError) redirectToQueue({ error: councilContextError.message })

  const effectiveOrganizationId = councilContext?.organization_id ?? claim.organization_id ?? null

  if (!effectiveOrganizationId) {
    redirectToQueue({ error: 'This request is not tied to a listed council yet. Seed the council first, then review again.' })
  }

  const normalizedEmail = normalizeClaimEmail(claim.requester_email)
  const identityFilters = [
    claim.requested_by_auth_user_id ? `user_id.eq.${claim.requested_by_auth_user_id}` : '',
    claim.requested_by_person_id ? `person_id.eq.${claim.requested_by_person_id}` : '',
    normalizedEmail ? `grantee_email.eq.${normalizedEmail}` : '',
  ].filter(Boolean)

  const [existingOrganizationAssignments, existingCouncilAssignments] = await Promise.all([
    identityFilters.length > 0
      ? admin
          .from('organization_admin_assignments')
          .select('id, is_active')
          .eq('organization_id', effectiveOrganizationId)
          .or(identityFilters.join(','))
          .limit(5)
      : Promise.resolve({ data: [] as { id: string; is_active: boolean }[] | null, error: null }),
    claim.council_id && identityFilters.length > 0
      ? admin
          .from('council_admin_assignments')
          .select('id, is_active')
          .eq('council_id', claim.council_id)
          .or(identityFilters.join(','))
          .limit(5)
      : Promise.resolve({ data: [] as { id: string; is_active: boolean }[] | null, error: null }),
  ])

  if (existingOrganizationAssignments.error) redirectToQueue({ error: existingOrganizationAssignments.error.message })
  if (existingCouncilAssignments.error) redirectToQueue({ error: existingCouncilAssignments.error.message })

  const alreadyHasOrganizationAdmin = (existingOrganizationAssignments.data ?? []).some((assignment) => assignment.is_active)
  const alreadyHasCouncilAdmin = (existingCouncilAssignments.data ?? []).some((assignment) => assignment.is_active)

  if (alreadyHasOrganizationAdmin || alreadyHasCouncilAdmin) {
    redirectToQueue({ error: 'This requester already has admin access for that organization.' })
  }

  try {
    await saveOrganizationAdminAssignment({
      organizationId: effectiveOrganizationId,
      actorUserId: permissions.authUser!.id,
      personId: claim.requested_by_person_id,
      userId: claim.requested_by_auth_user_id,
      granteeEmail: normalizedEmail,
      sourceCode: 'approved_claim',
      claimRequestId: claim.id,
      grantNotes: reviewNotes,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save admin access.'
    redirectToQueue({ error: message })
  }

  const { error: updateError } = await admin
    .from('organization_claim_requests')
    .update({
      status_code: 'approved',
      review_notes: reviewNotes,
      reviewed_at: new Date().toISOString(),
      reviewed_by_auth_user_id: permissions.authUser!.id,
      requester_notice_dismissed_at: null,
      requester_notice_dismissed_by_auth_user_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', claim.id)

  if (updateError) redirectToQueue({ error: updateError.message })

  if (normalizedEmail) {
    try {
      await sendOrganizationClaimReviewEmail({
        toEmail: normalizedEmail,
        toName: claim.requester_name,
        status: 'approved',
        councilLabel: buildCouncilLabel(claim),
        reviewNotes,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email send failed.'
      redirectToQueue({ error: `Claim approved, but the email could not be sent. ${message}` })
    }
  }

  revalidatePath('/super-admin/organization-claims')
  revalidatePath('/me')
  revalidatePath('/me/council')
  redirect('/super-admin/organization-claims')
}

export async function rejectOrganizationClaimAction(formData: FormData) {
  const permissions = await requireSuperAdmin()
  const claimId = normalizeClaimText(formData.get('claim_id') as string | null)
  const reviewNotes = normalizeClaimText(formData.get('review_notes') as string | null)

  if (!claimId) redirectToQueue({ error: 'Missing claim id for rejection.' })

  const admin = createAdminClient()
  const { data: claim, error: claimError } = await admin
    .from('organization_claim_requests')
    .select('id, requester_name, requester_email, requested_council_name, requested_council_number, requested_city')
    .eq('id', claimId)
    .maybeSingle()

  if (claimError) redirectToQueue({ error: claimError.message })
  if (!claim) redirectToQueue({ error: 'Claim request not found.' })

  const normalizedEmail = normalizeClaimEmail(claim.requester_email)

  const { error } = await admin
    .from('organization_claim_requests')
    .update({
      status_code: 'rejected',
      review_notes: reviewNotes,
      reviewed_at: new Date().toISOString(),
      reviewed_by_auth_user_id: permissions.authUser!.id,
      requester_notice_dismissed_at: null,
      requester_notice_dismissed_by_auth_user_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', claimId)

  if (error) redirectToQueue({ error: error.message })

  if (normalizedEmail) {
    try {
      await sendOrganizationClaimReviewEmail({
        toEmail: normalizedEmail,
        toName: claim.requester_name,
        status: 'rejected',
        councilLabel: buildCouncilLabel(claim),
        reviewNotes,
      })
    } catch (emailError) {
      const message = emailError instanceof Error ? emailError.message : 'Email send failed.'
      redirectToQueue({ error: `Claim rejected, but the email could not be sent. ${message}` })
    }
  }

  revalidatePath('/super-admin/organization-claims')
  revalidatePath('/me')
  redirect('/super-admin/organization-claims')
}
