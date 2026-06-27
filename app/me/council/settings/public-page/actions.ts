'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { setFlashMessage } from '@/lib/flash-messages'
import { buildCouncilPublicOrgSlug } from '@/lib/public-org-slugs'
import { createAdminClient } from '@/lib/supabase/admin'

const SETTINGS_PATH = '/me/council/settings/public-page'
const PUBLIC_CONTACT_ROUTE_KEY = 'public_contact'
const PUBLIC_GALLERY_BUCKET = 'local-unit-public-gallery'
const PUBLIC_GALLERY_MAX_IMAGES = 12
const PUBLIC_GALLERY_MAX_FILE_SIZE = 5 * 1024 * 1024
const PUBLIC_GALLERY_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

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

function getFileExtension(file: File) {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

function getUploadFiles(formData: FormData) {
  return formData
    .getAll('gallery_images')
    .filter((value): value is File => value instanceof File && value.size > 0)
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
    const { data: existingRoutes, error: existingError } = await admin
      .from('local_unit_message_routes')
      .select('id, is_active, updated_at')
      .eq('local_unit_id', localUnitId)
      .eq('route_key', PUBLIC_CONTACT_ROUTE_KEY)
      .order('is_active', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1)

    if (existingError) {
      throw new Error(existingError.message)
    }

    const existingRouteId = existingRoutes?.[0]?.id as string | undefined

    if (!recipientEmailValue) {
      const { error: clearError } = await admin
        .from('local_unit_message_routes')
        .update({
          is_active: false,
          updated_by_auth_user_id: authUserId,
        })
        .eq('local_unit_id', localUnitId)
        .eq('route_key', PUBLIC_CONTACT_ROUTE_KEY)
        .eq('is_active', true)

      if (clearError) {
        throw new Error(clearError.message)
      }

      revalidatePublicPageSurfaces(context)
      return await redirectToPublicPageSettings({ notice: 'Public contact recipient cleared.' })
    }

    if (!recipientEmail) {
      throw new Error('Enter a valid email address for public contact submissions.')
    }

    if (existingRouteId) {
      await admin
        .from('local_unit_message_routes')
        .update({
          is_active: false,
          updated_by_auth_user_id: authUserId,
        })
        .eq('local_unit_id', localUnitId)
        .eq('route_key', PUBLIC_CONTACT_ROUTE_KEY)
        .neq('id', existingRouteId)

      const { error: updateError } = await admin
        .from('local_unit_message_routes')
        .update({
          recipient_person_id: null,
          recipient_email: recipientEmail,
          recipient_label: recipientLabel,
          is_active: true,
          updated_by_auth_user_id: authUserId,
        })
        .eq('id', existingRouteId)

      if (updateError) {
        throw new Error(updateError.message)
      }
    } else {
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

export async function uploadPublicGalleryImagesAction(formData: FormData) {
  const context = await requirePublicPageSettingsAccess()
  const admin = createAdminClient()
  const localUnitId = context.localUnitId!
  const authUserId = context.permissions.authUser!.id
  const files = getUploadFiles(formData)

  if (files.length === 0) {
    return await redirectToPublicPageSettings({ error: 'Choose at least one image to upload.' })
  }

  try {
    const { count, error: countError } = await admin
      .from('local_unit_public_gallery_images')
      .select('id', { count: 'exact', head: true })
      .eq('local_unit_id', localUnitId)
      .eq('is_active', true)

    if (countError) {
      throw new Error(countError.message)
    }

    const activeCount = count ?? 0
    const availableSlots = PUBLIC_GALLERY_MAX_IMAGES - activeCount

    if (availableSlots <= 0) {
      throw new Error(`This gallery already has the maximum of ${PUBLIC_GALLERY_MAX_IMAGES} images.`)
    }

    if (files.length > availableSlots) {
      throw new Error(`You can upload ${availableSlots} more image${availableSlots === 1 ? '' : 's'} to this gallery.`)
    }

    const rows = []

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]

      if (!PUBLIC_GALLERY_ALLOWED_TYPES.has(file.type)) {
        throw new Error('Gallery images must be JPG, PNG, or WebP files.')
      }

      if (file.size > PUBLIC_GALLERY_MAX_FILE_SIZE) {
        throw new Error('Each gallery image must be 5 MB or smaller.')
      }

      const extension = getFileExtension(file)
      const storagePath = `${localUnitId}/${crypto.randomUUID()}.${extension}`
      const arrayBuffer = await file.arrayBuffer()
      const { error: uploadError } = await admin.storage
        .from(PUBLIC_GALLERY_BUCKET)
        .upload(storagePath, arrayBuffer, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      rows.push({
        local_unit_id: localUnitId,
        storage_bucket: PUBLIC_GALLERY_BUCKET,
        storage_path: storagePath,
        sort_order: activeCount + index + 1,
        is_active: true,
        created_by_auth_user_id: authUserId,
        updated_by_auth_user_id: authUserId,
      })
    }

    const { error: insertError } = await admin
      .from('local_unit_public_gallery_images')
      .insert(rows)

    if (insertError) {
      throw new Error(insertError.message)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'We could not upload those gallery images.'
    return await redirectToPublicPageSettings({ error: message })
  }

  revalidatePublicPageSurfaces(context)
  return await redirectToPublicPageSettings({ notice: 'Gallery images uploaded.' })
}

export async function savePublicGalleryImagesAction(formData: FormData) {
  const context = await requirePublicPageSettingsAccess()
  const admin = createAdminClient()
  const localUnitId = context.localUnitId!
  const authUserId = context.permissions.authUser!.id

  try {
    const { data: existingRows, error: existingError } = await admin
      .from('local_unit_public_gallery_images')
      .select('id')
      .eq('local_unit_id', localUnitId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(PUBLIC_GALLERY_MAX_IMAGES)

    if (existingError) {
      throw new Error(existingError.message)
    }

    for (const row of existingRows ?? []) {
      const id = row.id as string
      const title = textValue(formData, `gallery_title_${id}`)
      const sortOrderValue = textValue(formData, `gallery_sort_order_${id}`)
      const parsedSortOrder = Number.parseInt(sortOrderValue ?? '', 10)
      const sortOrder = Number.isFinite(parsedSortOrder) && parsedSortOrder >= 0 ? parsedSortOrder : 0

      const { error: updateError } = await admin
        .from('local_unit_public_gallery_images')
        .update({
          title,
          sort_order: sortOrder,
          updated_by_auth_user_id: authUserId,
        })
        .eq('id', id)
        .eq('local_unit_id', localUnitId)

      if (updateError) {
        throw new Error(updateError.message)
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'We could not save the gallery details.'
    return await redirectToPublicPageSettings({ error: message })
  }

  revalidatePublicPageSurfaces(context)
  return await redirectToPublicPageSettings({ notice: 'Gallery details saved.' })
}

export async function deletePublicGalleryImageAction(formData: FormData) {
  const context = await requirePublicPageSettingsAccess()
  const admin = createAdminClient()
  const localUnitId = context.localUnitId!
  const authUserId = context.permissions.authUser!.id
  const imageId = textValue(formData, 'gallery_image_id')

  if (!imageId) {
    return await redirectToPublicPageSettings({ error: 'Choose a gallery image to remove.' })
  }

  try {
    const { error: updateError } = await admin
      .from('local_unit_public_gallery_images')
      .update({
        is_active: false,
        updated_by_auth_user_id: authUserId,
      })
      .eq('id', imageId)
      .eq('local_unit_id', localUnitId)

    if (updateError) {
      throw new Error(updateError.message)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'We could not remove that gallery image.'
    return await redirectToPublicPageSettings({ error: message })
  }

  revalidatePublicPageSurfaces(context)
  return await redirectToPublicPageSettings({ notice: 'Gallery image removed.' })
}
