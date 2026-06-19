'use server'

import { redirect } from 'next/navigation'
import { buildHashForField, decryptPeopleRecord, protectPeoplePayload } from '@/lib/security/pii'
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

type AdminAssignmentRow = {
  id: string
  grantee_email: string | null
  person_id: string | null
}

type PersonEmailRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

type PublicContactRecipient = {
  email: string
  name: string | null
  source: 'custom_route' | 'admin_default'
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function normalizeEmail(value: string | null | undefined) {
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

function displayNameForPerson(person: PersonEmailRow) {
  return [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || null
}

function dedupeRecipients(recipients: PublicContactRecipient[]) {
  const seen = new Set<string>()
  return recipients.flatMap((recipient) => {
    const email = normalizeEmail(recipient.email)
    if (!email || seen.has(email)) return []
    seen.add(email)
    return [{ ...recipient, email }]
  })
}

async function loadCustomContactRecipient(args: {
  admin: ReturnType<typeof createAdminClient>
  localUnitId: string
}): Promise<PublicContactRecipient | null> {
  const { data, error } = await (args.admin as any)
    .from('local_unit_message_routes')
    .select('recipient_email, recipient_label')
    .eq('local_unit_id', args.localUnitId)
    .eq('route_key', 'public_contact')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error) return null

  const route = ((data as MessageRouteRow[] | null) ?? [])[0] ?? null
  const email = normalizeEmail(route?.recipient_email ?? null)
  if (!email) return null

  return {
    email,
    name: route?.recipient_label ?? null,
    source: 'custom_route',
  }
}

async function loadDefaultAdminContactRecipients(args: {
  admin: ReturnType<typeof createAdminClient>
  organizationId: string | null | undefined
}): Promise<PublicContactRecipient[]> {
  if (!args.organizationId) return []

  const { data, error } = await args.admin
    .from('organization_admin_assignments')
    .select('id, grantee_email, person_id')
    .eq('organization_id', args.organizationId)
    .eq('is_active', true)

  if (error) throw new Error(error.message)

  const assignments = (data as AdminAssignmentRow[] | null) ?? []
  const directRecipients: PublicContactRecipient[] = assignments.flatMap((assignment) => {
    const email = normalizeEmail(assignment.grantee_email)
    return email ? [{ email, name: null, source: 'admin_default' as const }] : []
  })

  const personIds = assignments.flatMap((assignment) => assignment.person_id ? [assignment.person_id] : [])
  if (personIds.length === 0) return dedupeRecipients(directRecipients)

  const { data: peopleData, error: peopleError } = await args.admin
    .from('people')
    .select('id, first_name, last_name, email')
    .in('id', personIds)

  if (peopleError) throw new Error(peopleError.message)

  const personRecipients: PublicContactRecipient[] = ((peopleData as PersonEmailRow[] | null) ?? []).flatMap((person) => {
    const decrypted = decryptPeopleRecord(person)
    const email = normalizeEmail(decrypted.email)
    return email ? [{ email, name: displayNameForPerson(decrypted), source: 'admin_default' as const }] : []
  })

  return dedupeRecipients([...directRecipients, ...personRecipients])
}

async function loadContactRecipients(args: {
  admin: ReturnType<typeof createAdminClient>
  localUnitId: string
  organizationId: string | null | undefined
}) {
  const customRecipient = await loadCustomContactRecipient({
    admin: args.admin,
    localUnitId: args.localUnitId,
  })

  if (customRecipient) return [customRecipient]

  return loadDefaultAdminContactRecipients({
    admin: args.admin,
    organizationId: args.organizationId,
  })
}

async function loadPublicContext(args: { slug: string }) {
  const councilNumber = extractTrailingCouncilNumber(args.slug)
  if (!councilNumber) return null

  const admin = createAdminClient()
  const untypedAdmin = admin as any
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
      ? untypedAdmin
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

  const recipients = await loadContactRecipients({
    admin,
    localUnitId: localUnit.id,
    organizationId: council.organization_id,
  })

  if (recipients.length === 0) return null

  return { admin, council, organization, localUnit, recipients, canonicalSlug }
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

  const untypedAdmin = args.admin as any
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

  const { data: existingLocalUnitPerson } = await args.admin
    .from('local_unit_people')
    .select('id')
    .eq('local_unit_id', args.localUnitId)
    .eq('person_id', personId)
    .is('ended_at', null)
    .maybeSingle()

  if (!existingLocalUnitPerson?.id) {
    const { error } = await untypedAdmin
      .from('local_unit_people')
      .insert({
        local_unit_id: args.localUnitId,
        person_id: personId,
        source_code: 'public_landing_page',
        linked_at: new Date().toISOString(),
      })

    if (error && error.code !== '23505') {
      throw new Error(error.message)
    }
  }

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
  recipientSource: PublicContactRecipient['source']
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
    '',
    args.recipientSource === 'admin_default'
      ? 'Note: Public page inquiries are sent to active admins by default. You can change the recipient in Chrism under Council settings > Public Page.'
      : null,
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
    const jobs = context.recipients.map((recipient) => ({
      local_unit_id: context.localUnit.id,
      route_key: 'public_contact',
      inquiry_type_code: inquiryType,
      status_code: 'pending',
      recipient_email: recipient.email,
      recipient_label: recipient.name,
      reply_to_email: submitterEmail,
      submitter_name: submitterName,
      submitter_phone: submitterPhone,
      subject,
      body_text: buildMessageBody({
        orgName,
        inquiryType,
        submitterName,
        submitterEmail,
        submitterPhone,
        message,
        recipientSource: recipient.source,
      }),
      payload_snapshot: {
        inquiry_type: inquiryType,
        submitter_name: submitterName,
        submitter_email: submitterEmail,
        submitter_phone: submitterPhone,
        message,
        captured_person_id: capturedPersonId,
        recipient_source: recipient.source,
      },
      scheduled_for: new Date().toISOString(),
    }))

    const { error: jobError } = await (context.admin as any)
      .from('local_unit_public_contact_message_jobs')
      .insert(jobs)

    if (jobError) throw new Error(jobError.message)
  } catch {
    redirect(`/o/${context.canonicalSlug}?contact=error#contact`)
  }

  redirect(`/o/${context.canonicalSlug}?contact=sent#contact`)
}

function notFoundRedirect(): never {
  redirect('/')
}
