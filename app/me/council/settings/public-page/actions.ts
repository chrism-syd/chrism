'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { setFlashMessage } from '@/lib/flash-messages'
import { buildCouncilPublicOrgSlug } from '@/lib/public-org-slugs'
import { createAdminClient } from '@/lib/supabase/admin'

const SETTINGS_PATH = '/me/council/settings/public-page'
const PUBLIC_CONTACT_ROUTE_KEY = 'public_contact'

function textValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
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

function normalizeEmail(rawValue: string | null) {
  if (!rawValue) return null
  const normalized = rawValue.trim().toLowerCase()
  return normalized.includes('@') ? normalized : null
}

function normalizeExternalUrl(rawValue: string | null) {
  if (!rawValue) return null

  try {
    const parsed = new URL(rawValue)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

function buildExternalLinksPayload(args: {
  formData: FormData
  localUnitId: string
  authUserId: string
}) {
  return [1, 2, 3].flatMap((index) => {
    const label = textValue(args.formData, `external_link_${index}_label`)
    const rawUrl = textValue(args.formData, `external_link_${index}_url`)

    if (!label && !rawUrl) return []
    if (!label || !rawUrl) {
      throw new Error(`Enter both a label and URL for external link ${index}, or leave both blank.`)
    }

    const url = normalizeExternalUrl(rawUrl)
    if (!url) {
      throw new Error(`External link ${index} needs a valid http or https URL.`)
    }

    return [{
      local_unit_id: args.localUnitId,
      label,
      url,
      sort_order: index,
      is_active: true,
      created_by_auth_user_id: args.authUserId,
      updated_by_auth_user_id: args.authUserId,
    }]
  })
}

export async function updatePublicPageSettingsAction(formData: FormData) {
  const context = await requirePublicPageSettingsAccess()
  const publicDescription = textValue(formData, 'public_description')
  const publicPageEnabled = formData.get('public_page_enabled') === 'true'
  const publicContactFormEnabled = formData.get('public_contact_form_enabled') === 'true'

  const admin = createAdminClient()
  const { error } = await admin
    .from('organizations')
    .update({
      public_page_enabled: publicPageEnabled,
      public_description: publicDescription,
      public_contact_form_enabled: publicContactFormEnabled,
    })
    .eq('id', context.permissions.organizationId!)

  if (error) {
    return await redirectToPublicPageSettings({ error: error.message })
  }

  revalidatePublicPageSurfaces(context)
  return await redirectToPublicPageSettings({ notice: 'Public page settings saved.' })
}

export async function savePublicContactRouteAction(formData: FormData) {
  const context = await requirePublicPageSettingsAccess()
  const admin = createAdminClient()
  const localUnitId = context.localUnitId!
  const authUserId = context.permissions.authUser!.id
  const recipientEmailValue = textValue(formData, 'public_contact_recipient_email')
  const recipientLabel = textValue(formData, 'public_contact_recipient_label')
  const recipientEmail = normalizeEmail(recipientEmailValue)

  try {
    const { error: deactivateError } = await admin
      .from('local_unit_message_routes')
      .update({
        is_active: false,
        updated_by_auth_user_id: authUserId,
      })
      .eq('local_unit_id', localUnitId)
      .eq('route_key', PUBLIC_CONTACT_ROUTE_KEY)
      .eq('is_active', true)

    if (deactivateError) {
      throw new Error(deactivateError.message)
    }

    if (!recipientEmailValue) {
      revalidatePublicPageSurfaces(context)
      return await redirectToPublicPageSettings({ notice: 'Public contact recipient cleared.' })
    }

    if (!recipientEmail) {
      throw new Error('Enter a valid email address for public contact submissions.')
    }

    const { error: insertError } = await admin
      .from('local_unit_message_routes')
      .insert({
        local_unit_id: localUnitId,
        route_key: PUBLIC_CONTACT_ROUTE_KEY,
        recipient_person_id: null,
        recipient_email: recipientEmail,
        recipient_label: recipientLabel,
        is_active: true,
        created_by_auth_user_id: authUserId,
        updated_by_auth_user_id: authUserId,
      })

    if (insertError) {
      throw new Error(insertError.message)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'We could not save the public contact recipient.'
    return await redirectToPublicPageSettings({ error: message })
  }

  revalidatePublicPageSurfaces(context)
  return await redirectToPublicPageSettings({ notice: 'Public contact recipient saved.' })
}

export async function savePublicExternalLinksAction(formData: FormData) {
  const context = await requirePublicPageSettingsAccess()
  const admin = createAdminClient()
  const localUnitId = context.localUnitId!
  const authUserId = context.permissions.authUser!.id

  try {
    const links = buildExternalLinksPayload({ formData, localUnitId, authUserId })
    const { error: deleteError } = await admin
      .from('local_unit_external_links')
      .delete()
      .eq('local_unit_id', localUnitId)

    if (deleteError) {
      throw new Error(deleteError.message)
    }

    if (links.length > 0) {
      const { error: insertError } = await admin
        .from('local_unit_external_links')
        .insert(links)

      if (insertError) {
        throw new Error(insertError.message)
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'We could not save those external links.'
    return await redirectToPublicPageSettings({ error: message })
  }

  revalidatePublicPageSurfaces(context)
  return await redirectToPublicPageSettings({ notice: 'Public page links saved.' })
}
