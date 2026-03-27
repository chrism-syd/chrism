'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendOrganizationClaimReviewEmail } from '@/lib/email/organization-claim-review'
import { normalizeClaimEmail, normalizeClaimText } from '@/lib/organizations/claim-requests'

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
  if (!claim.organization_id) {
    redirectToQueue({ error: 'This request is not tied to a listed council yet. Seed the council first, then review again.' })
  }

  const normalizedEmail = normalizeClaimEmail(claim.requester_email)
  const filters = [
    claim.requested_by_auth_user_id ? `user_id.eq.${claim.requested_by_auth_user_id}` : '',
    claim.requested_by_person_id ? `person_id.eq.${claim.requested_by_person_id}` : '',
    normalizedEmail ? `grantee_email.eq.${normalizedEmail}` : '',
  ].filter(Boolean)

  const { data: existingAssignments, error: lookupError } = await admin
    .from('organization_admin_assignments')
    .select('id')
    .eq('organization_id', claim.organization_id)
    .or(filters.join(','))
    .limit(5)

  if (lookupError) redirectToQueue({ error: lookupError.message })

  const payload = {
    organization_id: claim.organization_id,
    user_id: claim.requested_by_auth_user_id,
    person_id: claim.requested_by_person_id,
    grantee_email: normalizedEmail,
    is_active: true,
    source_code: 'approved_claim',
    organization_claim_request_id: claim.id,
    grant_notes: reviewNotes,
    revoked_at: null,
    revoked_by_user_id: null,
    revoked_notes: null,
    created_by_user_id: permissions.authUser!.id,
    updated_by_user_id: permissions.authUser!.id,
  }

  const targetId = existingAssignments?.[0]?.id ?? null
  const mutation = targetId
    ? admin.from('organization_admin_assignments').update(payload).eq('id', targetId)
    : admin.from('organization_admin_assignments').insert(payload)

  const { error: saveError } = await mutation
  if (saveError) redirectToQueue({ error: saveError.message })

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
