import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { listAccessibleLocalUnitsForArea, type ManagedAreaAccessLevel, type ManagedAreaCode } from '@/lib/auth/area-access'
import {
  PARALLEL_AREA_SELECTION_COOKIE,
  buildParallelAreaChooserHref,
  upsertSelectedLocalUnitId,
} from '@/lib/auth/parallel-area-selection'

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
    const chooserHref = buildParallelAreaChooserHref({
      areaCode,
      minimumAccessLevel,
      nextPath,
    })
    return NextResponse.redirect(new URL(chooserHref, request.url))
  }

  const cookieStore = await cookies()
  cookieStore.set(
    PARALLEL_AREA_SELECTION_COOKIE,
    upsertSelectedLocalUnitId({
      rawCookieValue: cookieStore.get(PARALLEL_AREA_SELECTION_COOKIE)?.value ?? null,
      areaCode,
      localUnitId,
    }),
    {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    }
  )

  return NextResponse.redirect(new URL(nextPath, request.url))
}
