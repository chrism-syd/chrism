'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './mode-switcher.module.css'

type ModeSwitcherProps = {
  operationsHref?: string
  spiritualHref?: string
}

function OperationsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.modeIcon}>
      <circle cx="12" cy="12" r="7.25" fill="currentColor" stroke="currentColor" strokeWidth="0" />
    </svg>
  )
}

function SpiritualIcon() {
  return (
    <svg viewBox="0 0 24 26" aria-hidden="true" className={styles.modeIcon}>
      <path
        d="M12 3v17M6 9h12"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="square"
      />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={styles.chevronIcon}>
      <path
        d="M5.25 7.5 10 12.25 14.75 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function isSpiritualPath(pathname: string) {
  return (
    pathname === '/spiritual' ||
    pathname.startsWith('/spiritual/') ||
    pathname === '/prayer' ||
    pathname.startsWith('/prayer/') ||
    pathname === '/faith' ||
    pathname.startsWith('/faith/') ||
    pathname === '/companion' ||
    pathname.startsWith('/companion/')
  )
}

export default function ModeSwitcher({
  operationsHref = '/',
  spiritualHref = '/spiritual',
}: ModeSwitcherProps) {
  const pathname = usePathname()
  const currentMode = isSpiritualPath(pathname) ? 'spiritual' : 'operations'
  const isOperations = currentMode === 'operations'

  const currentLabel = isOperations ? 'Operations' : 'Spiritual'
  const alternateLabel = isOperations ? 'Spiritual' : 'Operations'
  const alternateHref = isOperations ? spiritualHref : operationsHref

  return (
    <div className={styles.wrapper}>
      <span className={styles.divider} aria-hidden="true" />

      <details className={styles.menu}>
        <summary className={styles.trigger} aria-label={`Current mode: ${currentLabel}`}>
          <span className={styles.triggerIconWrap}>
            {isOperations ? <OperationsIcon /> : <SpiritualIcon />}
          </span>
          <span className={styles.triggerLabel}>{currentLabel}</span>
          <span className={styles.triggerChevron}>
            <ChevronIcon />
          </span>
        </summary>

        <div className={styles.panel}>
          <Link href={alternateHref} className={styles.panelLink}>
            <span className={styles.panelIconWrap}>
              {isOperations ? <SpiritualIcon /> : <OperationsIcon />}
            </span>
            <span className={styles.panelLabel}>{alternateLabel}</span>
          </Link>
        </div>
      </details>
    </div>
  )
}
