'use server'

import { redirect } from 'next/navigation'
import {
  insertOrganizationClaimRequest,
  normalizeClaimEmail,
  normalizeClaimText,
} from '@/lib/organizations/claim-requests'

function redirectToClaimLanding(args: { error?: string | null; notice?: string | null }): never {
  const params = new URLSearchParams()

  if (args.error) {
    params.set('error', args.error)
  }

  if (args.notice) {
    params.set('notice', args.notice)
  }

  redirect(params.size > 0 ? `/claim-organization?${params.toString()}` : '/claim-organization')
}

export async function submitPublicOrganizationClaimAction(formData: FormData) {
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
    redirectToClaimLanding({ error: 'Enter your name and email before sending the request.' })
  }

  if (!selectedCouncilId && !(requestedCouncilName && requestedCity)) {
    redirectToClaimLanding({ error: 'Choose a listed council or switch to Request Access before submitting.' })
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
    redirectToClaimLanding({ error: message })
  }

  redirectToClaimLanding({ notice: 'Request submitted. We will review it before granting access.' })
}
