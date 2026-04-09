'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { getProfileChangeReviewSummary } from '@/lib/profile-change-reviews'
import { isValidEmailAddress } from '@/lib/security/contact-validation'
import { protectPeoplePayload } from '@/lib/security/pii'

function normalizeText(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function reviewProfileChangeRequestAction(formData: FormData) {
  const requestId = normalizeText(formData.get('request_id'))
  const decision = normalizeText(formData.get('decision'))
  const reviewNotes = normalizeText(formData.get('review_notes'))

  if (!requestId) {
    throw new Error('Missing profile change request id.')
  }

  if (decision !== 'approve' && decision !== 'reject') {
    throw new Error('Choose whether to approve or reject this request.')
  }

  const { admin, permissions, council } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/members/reviews',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  })

  if (!permissions.authUser) {
    throw new Error('You must be signed in to review profile changes.')
  }

  const summary = await getProfileChangeReviewSummary({
    admin,
    councilId: council.id,
    organizationId: council.organization_id ?? null,
    requestId,
  })

  if (!summary) {
    throw new Error('That profile change request could not be found.')
  }

  if (summary.request.status_code !== 'pending') {
    throw new Error('That profile change request has already been reviewed.')
  }

  const now = new Date().toISOString()

  if (decision === 'approve') {
    const firstNameField = summary.changedFields.find((field) => field.key === 'first_name')
    const lastNameField = summary.changedFields.find((field) => field.key === 'last_name')
    const preferredNameField = summary.changedFields.find((field) => field.key === 'preferred_name')
    const emailField = summary.changedFields.find((field) => field.key === 'email')
    const cellField = summary.changedFields.find((field) => field.key === 'cell_phone')
    const homeField = summary.changedFields.find((field) => field.key === 'home_phone')

    const nextFirstName = firstNameField?.requested ? firstNameField.proposedValue : summary.person.first_name
    const nextLastName = lastNameField?.requested ? lastNameField.proposedValue : summary.person.last_name
    const nextPreferredName = preferredNameField?.requested ? preferredNameField.proposedValue : summary.person.nickname
    const nextEmail = emailField?.requested ? emailField.proposedValue : summary.person.email
    const nextCellPhone = cellField?.requested ? cellField.proposedValue : summary.person.cell_phone
    const nextHomePhone = homeField?.requested ? homeField.proposedValue : summary.person.home_phone

    if (!nextFirstName?.trim()) {
      throw new Error('Approving this request would leave the member without a first name.')
    }

    if (!nextLastName?.trim()) {
      throw new Error('Approving this request would leave the member without a last name.')
    }

    if (nextEmail && !isValidEmailAddress(nextEmail)) {
      throw new Error('The submitted email address is not valid enough to approve.')
    }

    const hasAnyContact = Boolean(nextEmail || nextCellPhone || nextHomePhone || summary.person.other_phone)
    if (!hasAnyContact) {
      throw new Error('Approving this request would leave the member without any contact method on file.')
    }

    const peopleUpdate = protectPeoplePayload({
      first_name: nextFirstName,
      last_name: nextLastName,
      nickname: nextPreferredName,
      email: nextEmail,
      cell_phone: nextCellPhone,
      home_phone: nextHomePhone,
      updated_by_auth_user_id: permissions.authUser.id,
    })

    const { error: peopleError } = await admin
      .from('people')
      .update(peopleUpdate)
      .eq('id', summary.person.id)

    if (peopleError) {
      throw new Error(`Could not approve this change request: ${peopleError.message}`)
    }
  }

  const reviewPayload = {
    status_code: decision === 'approve' ? 'approved' : 'rejected',
    reviewed_at: now,
    reviewed_by_auth_user_id: permissions.authUser.id,
    review_notes: reviewNotes,
    decision_notice_cleared_at: null,
  }

  const { error: reviewError } = await admin
    .from('person_profile_change_requests')
    .update(reviewPayload)
    .eq('id', summary.request.id)

  if (reviewError) {
    throw new Error(`Could not save that review decision: ${reviewError.message}`)
  }

  revalidatePath('/me')
  revalidatePath('/members/reviews')
  revalidatePath('/members/reviews/archive')
  revalidatePath(`/members/reviews/${summary.request.id}`)
  revalidatePath(`/members/${summary.person.id}`)

  redirect('/members/reviews')
}

export async function clearReviewDecisionNoticeAction(formData: FormData) {
  const requestId = normalizeText(formData.get('request_id'))

  if (!requestId) {
    throw new Error('Missing review decision id.')
  }

  const { admin, permissions, council } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/members/reviews',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  })

  if (!permissions.authUser) {
    throw new Error('You must be signed in to clear review notifications.')
  }

  const summary = await getProfileChangeReviewSummary({
  admin,
  councilId: council.id,
  organizationId: council.organization_id ?? null,
  requestId,
})

  if (!summary) {
    throw new Error('That review decision could not be found.')
  }

  if (summary.request.status_code === 'pending') {
    throw new Error('Pending requests cannot be cleared from recent decisions.')
  }

  const { error } = await admin
    .from('person_profile_change_requests')
    .update({
      decision_notice_cleared_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (error) {
    throw new Error(`Could not clear that review notification: ${error.message}`)
  }

  revalidatePath('/members/reviews')
  revalidatePath('/members/reviews/archive')
  revalidatePath(`/members/reviews/${requestId}`)
  revalidatePath('/me')
}
