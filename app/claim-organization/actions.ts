'use server'

import {
  insertOrganizationClaimRequest,
  normalizeClaimEmail,
  normalizeClaimText,
} from '@/lib/organizations/claim-requests'
import type { ClaimOrganizationActionState } from '@/app/me/claim-organization/action-state'

export async function submitPublicOrganizationClaimAction(
  _previousState: ClaimOrganizationActionState,
  formData: FormData
): Promise<ClaimOrganizationActionState> {
  const selectedCouncilId = normalizeClaimText(formData.get('selected_council_id') as string | null)
  const selectedOrganizationId = normalizeClaimText(formData.get('selected_organization_id') as string | null)
  const requestedCouncilNumber = normalizeClaimText(formData.get('requested_council_number') as string | null)
  const requestedCouncilName = normalizeClaimText(formData.get('requested_council_name') as string | null)
  const requestedCity = normalizeClaimText(formData.get('requested_city') as string | null)
  const requesterName = normalizeClaimText(formData.get('requester_name') as string | null)
  const requesterEmail = normalizeClaimEmail(formData.get('requester_email') as string | null)
  const requesterPhone = normalizeClaimText(formData.get('requester_phone') as string | null)
  const requestNotes = normalizeClaimText(formData.get('request_notes') as string | null)

  if (!requesterName || !requesterEmail) {
    return { status: 'error', message: 'Enter your name and email before sending the request.' }
  }

  if (!selectedCouncilId && !(requestedCouncilName && requestedCity)) {
    return { status: 'error', message: 'Choose a listed council or switch to Request Access before submitting.' }
  }

  try {
    await insertOrganizationClaimRequest({
      organizationId: selectedOrganizationId,
      councilId: selectedCouncilId,
      requesterName,
      requesterEmail,
      requesterPhone,
      requestedCouncilNumber,
      requestedCouncilName,
      requestedCity,
      requestNotes,
      initiatedViaCode: 'public_request',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'We could not submit the request right now.'
    return { status: 'error', message }
  }

  return {
    status: 'success',
    message: 'Request submitted. We will review it before granting access.',
  }
}
