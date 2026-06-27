'use server'

/* eslint-disable @typescript-eslint/no-explicit-any -- local_unit_public_officers is added by this branch before generated Supabase types are refreshed. */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { setFlashMessage } from '@/lib/flash-messages'
import { buildCouncilPublicOrgSlug } from '@/lib/public-org-slugs'
import { createAdminClient } from '@/lib/supabase/admin'
import { listValidMemberPersonIdsForLocalUnit } from '@/lib/custom-lists'
import { decryptPeopleRecords } from '@/lib/security/pii'

const OFFICER_SETTINGS_PATH = '/me/council/settings/public-page/officers'
const PORTRAIT_BUCKET = 'people-portraits'
const PORTRAIT_MAX_FILE_SIZE = 5 * 1024 * 1024
const PORTRAIT_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

type ActingCouncilContext = Awaited<ReturnType<typeof getCurrentActingCouncilContext>>

type OfficerTermRecord = {
  id: string
  person_id: string
  office_scope_code: string
  office_code: string
  office_rank: number | null
}

type OfficerPublicRecord = {
  id: string
  photo_storage_bucket: string | null
  photo_storage_path: string | null
}

type PersonNameRecord = {
  id: string
  first_name: string
  last_name: string
  nickname: string | null
}

type UploadedImageFile = {
  name?: string
  type: string
  size: number
  arrayBuffer: () => Promise<ArrayBuffer>
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function numberValue(formData: FormData, key: string, fallback: number) {
  const value = Number.parseFloat(textValue(formData, key) ?? '')
  return Number.isFinite(value) ? value : fallback
}

function integerValue(formData: FormData, key: string, fallback: number) {
  const value = Number.parseInt(textValue(formData, key) ?? '', 10)
  return Number.isFinite(value) ? value : fallback
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function normalizeEmail(value: string | null) {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return normalized.includes('@') ? normalized : null
}

function officialMemberName(member: Pick<PersonNameRecord, 'first_name' | 'last_name'> | null) {
  if (!member) return null

  const firstName = member.first_name.trim()
  const lastName = member.last_name.trim()
  const name = `${firstName} ${lastName}`.trim()
  return name.length > 0 ? name : null
}

function preferredMemberName(member: PersonNameRecord | null, preferredDisplayName: string | null) {
  if (!member) return null

  const preferred = preferredDisplayName?.trim() || member.nickname?.trim() || member.first_name.trim()
  const lastName = member.last_name.trim()
  const name = `${preferred} ${lastName}`.trim()
  return name.length > 0 ? name : null
}

function isUploadedImageFile(value: FormDataEntryValue | null): value is UploadedImageFile {
  return Boolean(
    value &&
    typeof value !== 'string' &&
    typeof (value as Partial<UploadedImageFile>).arrayBuffer === 'function' &&
    typeof (value as Partial<UploadedImageFile>).type === 'string' &&
    typeof (value as Partial<UploadedImageFile>).size === 'number'
  )
}

function getFileExtension(file: UploadedImageFile) {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

function buildOfficerPortraitStoragePath(args: {
  localUnitId: string
  personId: string
  termId: string
  fileId: string
  extension: string
}) {
  return [
    'local-units',
    args.localUnitId,
    'people',
    args.personId,
    'public-officers',
    args.termId,
    'portrait',
    `${args.fileId}.${args.extension}`,
  ].join('/')
}

async function redirectToOfficerSettings(args: { error?: string | null; notice?: string | null }): Promise<never> {
  if (args.error) {
    await setFlashMessage('error', args.error)
  } else if (args.notice) {
    await setFlashMessage('notice', args.notice)
  }

  redirect(OFFICER_SETTINGS_PATH)
}

async function requireOfficerSettingsAccess() {
  const context = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/me',
    areaCode: 'local_unit_settings',
    minimumAccessLevel: 'manage',
  })

  if (!context.permissions.organizationId || !context.permissions.canAccessOrganizationSettings) {
    redirect('/me')
  }

  if (!context.localUnitId) {
    return await redirectToOfficerSettings({
      error: 'This view is missing its active local organization context. Refresh and try again.',
    })
  }

  return context
}

function publicOrgPathForContext(context: ActingCouncilContext) {
  const councilNumber = context.council.council_number
  if (!councilNumber) return null

  return `/o/${buildCouncilPublicOrgSlug({
    name: context.council.name,
    councilNumber,
  })}`
}

function revalidateOfficerSurfaces(context: ActingCouncilContext) {
  revalidatePath('/me')
  revalidatePath('/me/council')
  revalidatePath('/me/council/settings/public-page')
  revalidatePath(OFFICER_SETTINGS_PATH)

  const publicPath = publicOrgPathForContext(context)
  if (publicPath) {
    revalidatePath(publicPath)
    revalidatePath(`${publicPath}/officers`)
  }
}

async function loadOfficerTerm(args: {
  admin: ReturnType<typeof createAdminClient>
  context: ActingCouncilContext
  termId: string | null
}) {
  if (!args.termId) {
    return await redirectToOfficerSettings({ error: 'We could not tell which officer to update.' })
  }

  const { data: term, error } = await args.admin
    .from('person_officer_terms')
    .select('id, person_id, office_scope_code, office_code, office_rank')
    .eq('id', args.termId)
    .eq('council_id', args.context.council.id)
    .maybeSingle()

  if (error) {
    return await redirectToOfficerSettings({ error: error.message })
  }

  if (!term) {
    return await redirectToOfficerSettings({ error: 'That officer term could not be found.' })
  }

  const validPersonIds = await listValidMemberPersonIdsForLocalUnit({
    admin: args.admin,
    localUnitId: args.context.localUnitId!,
    personIds: [term.person_id],
  })

  if (!validPersonIds.includes(term.person_id)) {
    return await redirectToOfficerSettings({
      error: 'That officer is not an active member of this local organization.',
    })
  }

  return term as OfficerTermRecord
}

async function loadOfficerDisplayName(args: {
  admin: ReturnType<typeof createAdminClient>
  localUnitId: string
  personId: string
  usePreferredName: boolean
}) {
  const [{ data: personData }, { data: memberRecordData }] = await Promise.all([
    args.admin
      .from('people')
      .select('id, first_name, last_name, nickname')
      .eq('id', args.personId)
      .is('archived_at', null)
      .maybeSingle(),
    (args.admin as any)
      .from('member_records')
      .select('preferred_display_name')
      .eq('local_unit_id', args.localUnitId)
      .eq('legacy_people_id', args.personId)
      .is('archived_at', null)
      .maybeSingle(),
  ])

  if (!personData) return null

  const [person] = decryptPeopleRecords([personData as PersonNameRecord])
  if (!args.usePreferredName) return officialMemberName(person)

  return preferredMemberName(person, memberRecordData?.preferred_display_name ?? null)
}

async function ensureOfficerPublicRecord(args: {
  admin: ReturnType<typeof createAdminClient>
  context: ActingCouncilContext
  term: OfficerTermRecord
}) {
  const untypedAdmin = args.admin as any
  const localUnitId = args.context.localUnitId!
  const authUserId = args.context.permissions.authUser!.id

  const { data: existing, error: existingError } = await untypedAdmin
    .from('local_unit_public_officers')
    .select('id, photo_storage_bucket, photo_storage_path')
    .eq('local_unit_id', localUnitId)
    .eq('person_officer_term_id', args.term.id)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existing?.id) return existing as OfficerPublicRecord

  const { data: inserted, error: insertError } = await untypedAdmin
    .from('local_unit_public_officers')
    .insert({
      local_unit_id: localUnitId,
      person_officer_term_id: args.term.id,
      person_id: args.term.person_id,
      sort_order: 0,
      is_public: false,
      created_by_auth_user_id: authUserId,
      updated_by_auth_user_id: authUserId,
    })
    .select('id, photo_storage_bucket, photo_storage_path')
    .single()

  if (insertError) {
    throw new Error(insertError.message)
  }

  return inserted as OfficerPublicRecord
}

export async function saveOfficerPublicProfileAction(formData: FormData) {
  const context = await requireOfficerSettingsAccess()
  const admin = createAdminClient()
  const untypedAdmin = admin as any
  const term = await loadOfficerTerm({ admin, context, termId: textValue(formData, 'term_id') })
  const publicEmailValue = textValue(formData, 'public_email')
  const publicEmail = normalizeEmail(publicEmailValue)

  if (publicEmailValue && !publicEmail) {
    return await redirectToOfficerSettings({ error: 'Enter a valid public officer email, or leave it blank.' })
  }

  const customDisplayName = textValue(formData, 'display_name_override')
  const displayNameOverride = customDisplayName ?? await loadOfficerDisplayName({
    admin,
    localUnitId: context.localUnitId!,
    personId: term.person_id,
    usePreferredName: formData.get('use_preferred_name') === 'true',
  })

  const payload = {
    local_unit_id: context.localUnitId!,
    person_officer_term_id: term.id,
    person_id: term.person_id,
    display_name_override: displayNameOverride,
    public_title_override: textValue(formData, 'public_title_override'),
    public_email: publicEmail,
    is_public: formData.get('is_public') === 'true',
    sort_order: Math.max(0, integerValue(formData, 'sort_order', 0)),
    photo_zoom: clamp(numberValue(formData, 'photo_zoom', 1), 1, 3),
    photo_position_x: clamp(numberValue(formData, 'photo_position_x', 50), 0, 100),
    photo_position_y: clamp(numberValue(formData, 'photo_position_y', 50), 0, 100),
    updated_by_auth_user_id: context.permissions.authUser!.id,
  }

  const { error } = await untypedAdmin
    .from('local_unit_public_officers')
    .upsert(
      {
        ...payload,
        created_by_auth_user_id: context.permissions.authUser!.id,
      },
      { onConflict: 'local_unit_id,person_officer_term_id' }
    )

  if (error) {
    return await redirectToOfficerSettings({ error: error.message })
  }

  revalidateOfficerSurfaces(context)
  return await redirectToOfficerSettings({ notice: 'Officer public profile saved.' })
}

export async function uploadOfficerPortraitAction(formData: FormData) {
  const context = await requireOfficerSettingsAccess()
  const admin = createAdminClient()
  const term = await loadOfficerTerm({ admin, context, termId: textValue(formData, 'term_id') })
  const file = formData.get('officer_photo')

  if (!isUploadedImageFile(file) || file.size === 0) {
    return await redirectToOfficerSettings({ error: 'Choose a portrait image to upload.' })
  }

  if (!PORTRAIT_ALLOWED_TYPES.has(file.type)) {
    return await redirectToOfficerSettings({ error: 'Portraits must be JPG, PNG, or WebP files.' })
  }

  if (file.size > PORTRAIT_MAX_FILE_SIZE) {
    return await redirectToOfficerSettings({ error: 'Portrait images must be 5 MB or smaller.' })
  }

  try {
    const existing = await ensureOfficerPublicRecord({ admin, context, term })
    const extension = getFileExtension(file)
    const storagePath = buildOfficerPortraitStoragePath({
      localUnitId: context.localUnitId!,
      personId: term.person_id,
      termId: term.id,
      fileId: crypto.randomUUID(),
      extension,
    })
    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await admin.storage
      .from(PORTRAIT_BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    const { error: updateError } = await (admin as any)
      .from('local_unit_public_officers')
      .update({
        photo_storage_bucket: PORTRAIT_BUCKET,
        photo_storage_path: storagePath,
        photo_zoom: clamp(numberValue(formData, 'photo_zoom', 1), 1, 3),
        photo_position_x: clamp(numberValue(formData, 'photo_position_x', 50), 0, 100),
        photo_position_y: clamp(numberValue(formData, 'photo_position_y', 50), 0, 100),
        updated_by_auth_user_id: context.permissions.authUser!.id,
      })
      .eq('id', existing.id)
      .eq('local_unit_id', context.localUnitId!)

    if (updateError) {
      await admin.storage.from(PORTRAIT_BUCKET).remove([storagePath]).catch(() => null)
      throw new Error(updateError.message)
    }

    if (existing.photo_storage_bucket && existing.photo_storage_path) {
      await admin.storage.from(existing.photo_storage_bucket).remove([existing.photo_storage_path]).catch(() => null)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'We could not upload that portrait.'
    return await redirectToOfficerSettings({ error: message })
  }

  revalidateOfficerSurfaces(context)
  return await redirectToOfficerSettings({ notice: 'Officer portrait uploaded.' })
}

export async function removeOfficerPortraitAction(formData: FormData) {
  const context = await requireOfficerSettingsAccess()
  const admin = createAdminClient()
  const term = await loadOfficerTerm({ admin, context, termId: textValue(formData, 'term_id') })

  try {
    const existing = await ensureOfficerPublicRecord({ admin, context, term })
    const { error } = await (admin as any)
      .from('local_unit_public_officers')
      .update({
        photo_storage_bucket: null,
        photo_storage_path: null,
        photo_zoom: 1,
        photo_position_x: 50,
        photo_position_y: 50,
        updated_by_auth_user_id: context.permissions.authUser!.id,
      })
      .eq('id', existing.id)
      .eq('local_unit_id', context.localUnitId!)

    if (error) {
      throw new Error(error.message)
    }

    if (existing.photo_storage_bucket && existing.photo_storage_path) {
      await admin.storage.from(existing.photo_storage_bucket).remove([existing.photo_storage_path]).catch(() => null)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'We could not remove that portrait.'
    return await redirectToOfficerSettings({ error: message })
  }

  revalidateOfficerSurfaces(context)
  return await redirectToOfficerSettings({ notice: 'Officer portrait removed.' })
}
