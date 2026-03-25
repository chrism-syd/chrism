'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export type PublicMeetingKindFilter = 'all' | 'general' | 'executive'

type MeetingKindFilterProps = {
  value?: PublicMeetingKindFilter
  selectedValue?: PublicMeetingKindFilter
}

const OPTIONS = [
  { value: 'all', label: 'All meetings' },
  { value: 'general', label: 'General meetings' },
  { value: 'executive', label: 'Executive meetings' },
] as const

export function MeetingKindFilter({ value, selectedValue }: MeetingKindFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const detailsRef = useRef<HTMLDetailsElement | null>(null)
  const [open, setOpen] = useState(false)

  const currentValue = selectedValue ?? value ?? 'all'
  const activeOption = OPTIONS.find((option) => option.value === currentValue) ?? OPTIONS[0]

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (!detailsRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  useEffect(() => {
    if (!open && detailsRef.current?.open) {
      detailsRef.current.open = false
    }
  }, [open])

  function applyFilter(nextValue: string) {
    const nextParams = new URLSearchParams(searchParams.toString())

    if (nextValue === 'all') {
      nextParams.delete('kind')
    } else {
      nextParams.set('kind', nextValue)
    }

    const query = nextParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    setOpen(false)
  }

  return (
    <div className="qv-meeting-filter-wrap">
      <details
        ref={detailsRef}
        className="qv-view-menu"
        open={open}
        onToggle={(event) => {
          setOpen(event.currentTarget.open)
        }}
      >
        <summary aria-haspopup="menu" aria-expanded={open}>
          <span>{activeOption.label}</span>
          <span className="qv-view-menu-chevron" aria-hidden="true">
            ▾
          </span>
        </summary>
        <div className="qv-view-menu-panel" role="menu" aria-label="Meeting filter">
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="qv-view-menu-item"
              aria-pressed={option.value === activeOption.value}
              onClick={() => applyFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </details>
    </div>
  )
}

export default MeetingKindFilter
