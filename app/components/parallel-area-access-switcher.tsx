'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  buildParallelAreaChooserHref,
  getManagedAreaLabel,
  inferAreaSelectionFromPath,
} from '@/lib/auth/parallel-area-selection'
import type { ManagedAreaAccessLevel, ManagedAreaCode } from '@/lib/auth/area-access'

type ParallelAreaAccessSwitcherProps = {
  switchableAreas?: Partial<Record<ManagedAreaCode, boolean>>
}

type SwitcherAreaConfig = {
  areaCode: ManagedAreaCode
  minimumAccessLevel: ManagedAreaAccessLevel
  defaultPath: string
}

const SWITCHABLE_AREA_CONFIG: SwitcherAreaConfig[] = [
  { areaCode: 'members', minimumAccessLevel: 'edit_manage', defaultPath: '/members' },
  { areaCode: 'events', minimumAccessLevel: 'manage', defaultPath: '/events' },
  { areaCode: 'custom_lists', minimumAccessLevel: 'interact', defaultPath: '/custom-lists' },
  { areaCode: 'local_unit_settings', minimumAccessLevel: 'manage', defaultPath: '/me/council' },
]

export default function ParallelAreaAccessSwitcher({ switchableAreas }: ParallelAreaAccessSwitcherProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const areaMatch = inferAreaSelectionFromPath(pathname)
  const queryString = searchParams?.toString()
  const currentPath = pathname ? (queryString ? `${pathname}?${queryString}` : pathname) : null

  const links = SWITCHABLE_AREA_CONFIG.filter(({ areaCode }) => Boolean(switchableAreas?.[areaCode]))
    .map((config) => {
      const nextPath = areaMatch?.areaCode === config.areaCode ? currentPath : config.defaultPath
      return {
        areaCode: config.areaCode,
        label: getManagedAreaLabel(config.areaCode),
        href: buildParallelAreaChooserHref({
          areaCode: config.areaCode,
          minimumAccessLevel: config.minimumAccessLevel,
          nextPath,
        }),
      }
    })

  if (links.length === 0) return null

  return (
    <>
      <div className="qv-user-menu-divider" />
      {links.map((link) => (
        <Link key={link.areaCode} href={link.href} className="qv-user-menu-link" prefetch={false}>
          Switch {link.label.toLowerCase()} organization
        </Link>
      ))}
    </>
  )
}
