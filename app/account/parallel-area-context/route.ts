import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { ACTIVE_ACCESS_CONTEXT_COOKIE } from '@/lib/auth/super-admin'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { listAccessibleLocalUnitsForArea, type ManagedAreaAccessLevel, type ManagedAreaCode } from '@/lib/auth/area-access'
import {
  OPERATIONS_SCOPE_COOKIE,
  buildAreaScopeChooserHref,
  setSelectedOperationsLocalUnitId,
} from '@/lib/auth/operations-scope-selection'

function normalizeAreaCode(value: string | null): ManagedAreaCode | null {
  if (
    value === 'members' ||
    value === 'events' ||
    value === 'custom_lists' ||
    value === 'claims' ||
    value === 'admins' ||
    value === 'local_unit_settings'
  ) {
    return value
  }

  return null
}

function normalizeAccessLevel(value: string | null): ManagedAreaAccessLevel | null {
  if (
    value === 'read_only' ||
    value === 'edit_manage' ||
    value === 'manage' ||
    value === 'interact'
  ) {
    return value
  }

  return null
}

function normalizeNextPath(value: string | null) {
  const trimmed = value?.trim() ?? ''
  if (!trimmed.startsWith('/')) return '/me'
  return trimmed
}

function pickContextKeyForLocalUnit(args: {
  localUnit: { id: string; legacy_council_id: string | null; legacy_organization_id: string | null }
  availableContexts: Array<{
    key: string
    localUnitId: string | null
    accessLevel: 'member' | 'admin' | 'manager'
    councilId: string | null
    organizationId: string | null
  }>
}) {
  const staffContexts = args.availableContexts.filter((context) => context.accessLevel !== 'member')

  const exactLocalUnitMatch =
    staffContexts.find((context) => context.localUnitId === args.localUnit.id) ?? null

  if (exactLocalUnitMatch?.key) {
    return exactLocalUnitMatch.key
  }

  const exactCouncilMatch = args.localUnit.legacy_council_id
    ? staffContexts.find((context) => context.councilId === args.localUnit.legacy_council_id) ?? null
    : null

  if (exactCouncilMatch?.key) {
    return exactCouncilMatch.key
  }

  const exactOrganizationMatch = args.localUnit.legacy_organization_id
    ? staffContexts.find((context) => context.organizationId === args.localUnit.legacy_organization_id) ?? null
    : null

  if (exactOrganizationMatch?.key) {
    return exactOrganizationMatch.key
  }

  return null
}

export async function POST(request: Request) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const formData = await request.formData()
  const areaCode = normalizeAreaCode(String(formData.get('areaCode') ?? ''))
  const minimumAccessLevel = normalizeAccessLevel(String(formData.get('minimumAccessLevel') ?? ''))
  const localUnitId = String(formData.get('localUnitId') ?? '').trim() || null
  const nextPath = normalizeNextPath(String(formData.get('next') ?? '/me'))

  if (!areaCode || !minimumAccessLevel) {
    return NextResponse.redirect(new URL('/me', request.url))
  }

  const accessibleLocalUnits = await listAccessibleLocalUnitsForArea({
    userId: permissions.authUser.id,
    areaCode,
    minimumAccessLevel,
  })

  const isAllowedSelection = localUnitId
    ? accessibleLocalUnits.some((unit) => unit.local_unit_id === localUnitId)
    : false

  if (!isAllowedSelection) {
    const chooserHref = buildAreaScopeChooserHref({
      areaCode,
      minimumAccessLevel,
      nextPath,
    })
    return NextResponse.redirect(new URL(chooserHref, request.url))
  }

  const cookieStore = await cookies()
  cookieStore.set(
    OPERATIONS_SCOPE_COOKIE,
    setSelectedOperationsLocalUnitId({
      rawCookieValue: cookieStore.get(OPERATIONS_SCOPE_COOKIE)?.value ?? null,
      localUnitId,
    }),
    {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    }
  )

  if (localUnitId) {
    const admin = createAdminClient()
    const { data: localUnitData } = await admin
      .from('local_units')
      .select('id, legacy_council_id, legacy_organization_id')
      .eq('id', localUnitId)
      .maybeSingle<{ id: string; legacy_council_id: string | null; legacy_organization_id: string | null }>()

    const localUnit = localUnitData ?? null
    if (localUnit) {
      const contextKey = pickContextKeyForLocalUnit({
        localUnit,
        availableContexts: permissions.availableContexts,
      })

      if (contextKey) {
        cookieStore.set(ACTIVE_ACCESS_CONTEXT_COOKIE, contextKey, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        })
      }
    }
  }

  return NextResponse.redirect(new URL(nextPath, request.url))
}
