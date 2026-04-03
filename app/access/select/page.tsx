import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { listAccessibleLocalUnitsForArea, type ManagedAreaAccessLevel, type ManagedAreaCode } from '@/lib/auth/area-access'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'
import { getManagedAreaLabel } from '@/lib/auth/parallel-area-selection'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

type LocalUnitOption = {
  local_unit_id: string
  local_unit_name: string
  area_code: ManagedAreaCode
  access_level: ManagedAreaAccessLevel
}

function normalizeSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function normalizeAreaCode(value: string): ManagedAreaCode | null {
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

function normalizeAccessLevel(value: string): ManagedAreaAccessLevel | null {
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

function normalizeNextPath(value: string) {
  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) return '/me'
  return trimmed
}

function getAccessLevelLabel(value: ManagedAreaAccessLevel) {
  if (value === 'edit_manage') return 'Edit and manage'
  if (value === 'read_only') return 'Read only'
  if (value === 'interact') return 'Interact'
  return 'Manage'
}

export default async function ParallelAreaAccessSelectionPage(props: { searchParams: SearchParams }) {
  const permissions = await getCurrentUserPermissions()
  if (!permissions.authUser) redirect('/login')

  const searchParams = await props.searchParams
  const areaCode = normalizeAreaCode(normalizeSingle(searchParams.area))
  const minimumAccessLevel = normalizeAccessLevel(normalizeSingle(searchParams.level))
  const nextPath = normalizeNextPath(normalizeSingle(searchParams.next) || '/me')

  if (!areaCode || !minimumAccessLevel) {
    redirect('/me')
  }

  const accessibleLocalUnits = await listAccessibleLocalUnitsForArea({
    userId: permissions.authUser.id,
    areaCode,
    minimumAccessLevel,
  })

  if (accessibleLocalUnits.length === 0) redirect('/me')
  if (accessibleLocalUnits.length === 1) redirect(nextPath)

  const sortedUnits = [...accessibleLocalUnits].sort((left, right) =>
    left.local_unit_name.localeCompare(right.local_unit_name)
  )
  const areaLabel = getManagedAreaLabel(areaCode)
  const levelLabel = getAccessLevelLabel(minimumAccessLevel)

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card qv-compact-card">
          <div className="qv-directory-hero">
            <div className="qv-directory-text">
              <p className="qv-eyebrow">Choose organization</p>
              <h1 className="qv-title">{areaLabel}</h1>
              <p className="qv-subtitle">
                You have {levelLabel.toLowerCase()} access in more than one local unit. Pick the one you want to work in for this area.
              </p>
            </div>
          </div>
        </section>

        <section className="qv-card qv-stack" style={{ gap: 12 }}>
          {sortedUnits.map((unit: LocalUnitOption) => (
            <form key={unit.local_unit_id} method="post" action="/account/parallel-area-context">
              <input type="hidden" name="areaCode" value={areaCode} />
              <input type="hidden" name="minimumAccessLevel" value={minimumAccessLevel} />
              <input type="hidden" name="localUnitId" value={unit.local_unit_id} />
              <input type="hidden" name="next" value={nextPath} />
              <button type="submit" className="qv-user-menu-link" style={{ minHeight: 56, border: '1px solid var(--divider)' }}>
                <span style={{ display: 'grid', gap: 4 }}>
                  <span style={{ fontWeight: 700 }}>{unit.local_unit_name}</span>
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    {areaLabel} • {getAccessLevelLabel(unit.access_level)}
                  </span>
                </span>
              </button>
            </form>
          ))}
        </section>

        <section className="qv-card qv-compact-card" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <p className="qv-empty-text" style={{ margin: 0 }}>
            Your choice only affects this area. You can switch again later from the menu.
          </p>
          <Link href={nextPath} className="qv-secondary-button">
            Cancel
          </Link>
        </section>
      </div>
    </main>
  )
}
