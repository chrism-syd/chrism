'use server'

import { redirect } from 'next/navigation'
import { buildHashForField, protectPeoplePayload } from '@/lib/security/pii'
import { buildCouncilPublicOrgSlug, extractTrailingCouncilNumber } from '@/lib/public-org-slugs'
import { createAdminClient } from '@/lib/supabase/admin'

type InquiryTypeCode = 'volunteer' | 'membership' | 'general_question' | 'help_request' | 'other'

type CouncilRow = {
  id: string
  name: string | null
  council_number: string | null
  organization_id: string | null
}

type LocalUnitRow = {
  id: string
}

type OrganizationRow = {
  display_name: string | null
  preferred_name: string | null
  public_page_enabled: boolean | null
  public_contact_form_enabled: boolean | null
}

type MessageRouteRow = {
  recipient_email: string | null
  recipient_label: string | null
}

type PersonRow = {
  id: string
  primary_relationship_code: string
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function normalizeEmail(value: string | null) {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return normalized.includes('@') ? normalized : null
}

function inquiryTypeLabel(code: InquiryTypeCode) {
  if (code === 'volunteer') return 'I want to volunteer'
  if (code === 'membership') return "I'm interested in joining"
  if (code === 'general_question') return 'I have a general question'
  if (code === 'help_request') return 'I need help with something'
  return 'Other'
}

function normalizeInquiryType(value: string | null): InquiryTypeCode {
  if (value === 'volunteer') return 'volunteer'
  if (value === 'membership') return 'membership'
  if (value === 'help_request') return 'help_request'
  if (value === 'other') return 'other'
  return 'general_question'
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const firstName = parts[0] ?? fullName
  const lastName = parts.slice(1).join(' ') || 'Unknown'

  return { firstName, lastName }
}

async function loadPublicContext(args: { slug: string }) {
  const councilNumber = extractTrailingCouncilNumber(args.slug)
  if (!councilNumber) return null

  const admin = createAdminClient()
  const { data: councilData } = await admin
    .from('councils')
    .select('id, name, council_number, organization_id')
    .eq('council_number', councilNumber)
    .maybeSingle()

  const council = councilData as CouncilRow | null
  if (!council?.id) return null

  const canonicalSlug = buildCouncilPublicOrgSlug({ name: council.name, councilNumber: council.council_number })
  if (args.slug !== canonicalSlug) return null

  const [{ data: organizationData }, { data: localUnitData }] = await Promise.all([
    council.organization_id
      ? admin
          .from('organizations')
          .select('display_name, preferred_name, public_page_enabled, public_contact_form_enabled')
          .eq('id', council.organization_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from('local_units')
      .select('id')
      .eq('legacy_council_id', council.id)
      .maybeSingle(),
  ])

  const organization = organizationData as OrganizationRow | null
  const localUnit = localUnitData as LocalUnitRow | null

  if (organization?.public_page_enabled === false) return null
  if (organization?.public_contact_form_enabled === false) return null
  if (!localUnit?.id) return null

  const { data: routeData } = await admin
    .from('local_unit_message_routes')
    .select('recipient_email, recipient_label')
    .eq('local_unit_id', localUnit.id)
    .eq('route_key', 'public_contact')
    .eq('is_active', true)
    .maybeSingle()

  const route = routeData as MessageRouteRow | null
  const recipientEmail = normalizeEmail(route?.recipient_email ?? null)
  if (!recipientEmail) return null

  return { admin, council, organization, localUnit, route: { ...route, recipient_email: recipientEmail }, canonicalSlug }
}

async function findOrCreateDirectoryPerson(args: {
  admin: ReturnType<typeof createAdminClient>
  councilId: string
  localUnitId: string
  inquiryType: InquiryTypeCode
  submitterName: string
  submitterEmail: string
  submitterPhone: string | null
}) {
  if (args.inquiryType !== 'volunteer' && args.inquiryType !== 'membership') return null

  const emailHash = buildHashForField('email', args.submitterEmail)
  let existingPerson: PersonRow | null = null

  if (emailHash) {
    const { data } = await args.admin
      .from('people')
      .select('id, primary_relationship_code')
      .eq('council_id', args.councilId)
      .eq('email_hash', emailHash)
      .is('archived_at', null)
      .limit(1)
      .maybeSingle()

    existingPerson = data as PersonRow | null
  }

  const personId = existingPerson?.id ?? await createDirectoryPerson(args)

  await args.admin
    .from('local_unit_people')
    .insert({
      local_unit_id: args.localUnitId,
      person_id: personId,
      source_code: 'public_landing_page',
      linked_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle()

  return personId
}

async function createDirectoryPerson(args: {
  admin: ReturnType<typeof createAdminClient>
  councilId: string
  localUnitId: string
  inquiryType: InquiryTypeCode
  submitterName: string
  submitterEmail: string
  submitterPhone: string | null
}) {
  const { firstName, lastName } = splitName(args.submitterName)
  const protectedPayload = protectPeoplePayload({
    council_id: args.councilId,
    first_name: firstName,
    last_name: lastName,
    directory_display_name_override: args.submitterName,
    primary_relationship_code: args.inquiryType === 'volunteer' ? 'volunteer_only' : 'prospect',
    created_source_code: args.inquiryType === 'volunteer' ? 'scoped_manual_volunteer' : 'scoped_manual_prospect',
    prospect_status_code: args.inquiryType === 'membership' ? 'new' : null,
    volunteer_context_code: args.inquiryType === 'volunteer' ? 'unknown' : null,
    email: args.submitterEmail,
    cell_phone: args.submitterPhone,
  })

  const { data, error } = await args.admin
    .from('people')
    .insert(protectedPayload)
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new Error(error?.message ?? 'Could not create a directory record for this inquiry.')
  }

  return data.id as string
}

function buildMessageBody(args: {
  orgName: string
  inquiryType: InquiryTypeCode
  submitterName: string
  submitterEmail: string
  submitterPhone: string | null
  message: string
}) {
  return [
    `New public page inquiry for ${args.orgName}`,
    '',
    `Inquiry type: ${inquiryTypeLabel(args.inquiryType)}`,
    `Name: ${args.submitterName}`,
    `Email: ${args.submitterEmail}`,
    args.submitterPhone ? `Phone: ${args.submitterPhone}` : null,
    '',
    args.message,
  ].filter(Boolean).join('\n')
}

export async function submitPublicContactFormAction(formData: FormData) {
  const slug = textValue(formData, 'slug')
  if (!slug) notFoundRedirect()

  const context = await loadPublicContext({ slug })
  if (!context) notFoundRedirect()

  const inquiryType = normalizeInquiryType(textValue(formData, 'inquiry_type'))
  const submitterName = textValue(formData, 'name')
  const submitterEmail = normalizeEmail(textValue(formData, 'email'))
  const submitterPhone = textValue(formData, 'phone')
  const message = textValue(formData, 'message')

  if (!submitterName || !submitterEmail || !message) {
    redirect(`/o/${context.canonicalSlug}?contact=missing#contact`)
  }

  let capturedPersonId: string | null = null

  try {
    capturedPersonId = await findOrCreateDirectoryPerson({
      admin: context.admin,
      councilId: context.council.id,
      localUnitId: context.localUnit.id,
      inquiryType,
      submitterName,
      submitterEmail,
      submitterPhone,
    })

    const orgName = context.organization?.preferred_name ?? context.organization?.display_name ?? context.council.name ?? 'your organization'
    const subject = `${inquiryTypeLabel(inquiryType)} - ${submitterName}`
    const bodyText = buildMessageBody({
      orgName,
      inquiryType,
      submitterName,
      submitterEmail,
      submitterPhone,
      message,
    })

    const { error: jobError } = await context.admin
      .from('local_unit_public_contact_message_jobs')
      .insert({
        local_unit_id: context.localUnit.id,
        route_key: 'public_contact',
        inquiry_type_code: inquiryType,
        status_code: 'pending',
        recipient_email: context.route.recipient_email,
        recipient_label: context.route.recipient_label,
        reply_to_email: submitterEmail,
        submitter_name: submitterName,
        submitter_phone: submitterPhone,
        subject,
        body_text: bodyText,
        payload_snapshot: {
          inquiry_type: inquiryType,
          submitter_name: submitterName,
          submitter_email: submitterEmail,
          submitter_phone: submitterPhone,
          message,
          captured_person_id: capturedPersonId,
        },
        scheduled_for: new Date().toISOString(),
      })

    if (jobError) {
      throw new Error(jobError.message)
    }
  } catch {
    redirect(`/o/${context.canonicalSlug}?contact=error#contact`)
  }

  redirect(`/o/${context.canonicalSlug}?contact=sent#contact`)
}

function notFoundRedirect(): never {
  redirect('/')
}
