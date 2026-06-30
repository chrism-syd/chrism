'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { setFlashMessage } from '@/lib/flash-messages'
import { buildCouncilPublicOrgSlug } from '@/lib/public-org-slugs'
import { createAdminClient } from '@/lib/supabase/admin'

const SETTINGS_PATH = '/me/council/settings/public-page'

type PublicContactDetailsDbError = {
  message: string
}

type PublicContactDetailsQueryResult<TData = unknown> = {
  data: TData | null
  error: PublicContactDetailsDbError | null
}

type PublicContactDetailsQueryBuilder<TData = unknown> = PromiseLike<PublicContactDetailsQueryResult<TData>> & {
  update(values: unknown): PublicContactDetailsQueryBuilder<TData>
  eq(column: string, value: unknown): PublicContactDetailsQueryBuilder<TData>
}

function publicContactDetailsFrom<TData = unknown>(admin: ReturnType<typeof createAdminClient>, table: string) {
  const compatAdmin = admin as unknown as {
    from: (table: string) => PublicContactDetailsQueryBuilder<TData>
  }

  return compatAdmin.from(table)
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function normalizeEmail(rawValue: string | null) {
  if (!rawValue) return null
  const normalized = rawValue.trim().toLowerCase()
  return normalized.includes('@') ? normalized : null
}

function normalizeExternalUrl(rawValue: string | null) {
  if (!rawValue) return null

  try {
    const parsed = new URL(rawValue)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

async function redirectToPublicPageSettings(args: { error?: string | null; notice?: string | null }): Promise<never> {
  if (args.error) {
    await setFlashMessage('error', args.error)
  } else if (args.notice) {
    await setFlashMessage('notice', args.notice)
  }

  redirect(SETTINGS_PATH)
}

async function requirePublicPageSettingsAccess() {
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
    return await redirectToPublicPageSettings({
      error: 'This view is missing its active local organization context. Refresh and try again.',
    })
  }

  return context
}

function publicOrgPathForContext(context: Awaited<ReturnType<typeof getCurrentActingCouncilContext>>) {
  const councilNumber = context.council.council_number
  if (!councilNumber) return null

  return `/o/${buildCouncilPublicOrgSlug({
    name: context.council.name,
    councilNumber,
  })}`
}

function revalidatePublicPageSurfaces(context: Awaited<ReturnType<typeof getCurrentActingCouncilContext>>) {
  revalidatePath('/me')
  revalidatePath('/me/council')
  revalidatePath(SETTINGS_PATH)

  const publicPath = publicOrgPathForContext(context)
  if (publicPath) {
    revalidatePath(publicPath)
  }
}

export async function savePublicContactDetailsAction(formData: FormData) {
  const context = await requirePublicPageSettingsAccess()
  const admin = createAdminClient()
  const localUnitId = context.localUnitId!
  const authUserId = context.permissions.authUser!.id

  const rawEmail = textValue(formData, 'public_email')
  const publicEmail = normalizeEmail(rawEmail)
  const publicLocationUrlValue = textValue(formData, 'public_location_url')
  const publicLocationUrl = normalizeExternalUrl(publicLocationUrlValue)

  if (rawEmail && !publicEmail) {
    return await redirectToPublicPageSettings({ error: 'Enter a valid public email address.' })
  }

  if (publicLocationUrlValue && !publicLocationUrl) {
    return await redirectToPublicPageSettings({ error: 'Enter a valid public location URL starting with http or https.' })
  }

  const { error } = await publicContactDetailsFrom(admin, 'local_units')
    .update({
      public_email: publicEmail,
      public_location_name: textValue(formData, 'public_location_name'),
      public_address_line1: textValue(formData, 'public_address_line1'),
      public_address_line2: textValue(formData, 'public_address_line2'),
      public_city: textValue(formData, 'public_city'),
      public_region: textValue(formData, 'public_region'),
      public_postal_code: textValue(formData, 'public_postal_code'),
      public_country: textValue(formData, 'public_country'),
      public_location_url: publicLocationUrl,
      updated_by_auth_user_id: authUserId,
    })
    .eq('id', localUnitId)

  if (error) {
    return await redirectToPublicPageSettings({ error: error.message })
  }

  revalidatePublicPageSurfaces(context)
  return await redirectToPublicPageSettings({ notice: 'Public contact details saved.' })
}
