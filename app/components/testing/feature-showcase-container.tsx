'use client'

import { useMemo, useState, type ReactNode } from 'react'

type FeatureShowcaseItem = {
  id: string
  label: string
  title: string
  description: string
  panelContent: ReactNode
}

type FeatureShowcaseContainerProps = {
  eyebrow?: string
  title: string
  intro?: string
  items: FeatureShowcaseItem[]
  initialItemId?: string
}

export default function FeatureShowcaseContainer({
  eyebrow,
  title,
  intro,
  items,
  initialItemId,
}: FeatureShowcaseContainerProps) {
  const fallbackId = items[0]?.id ?? null
  const startingId = initialItemId && items.some((item) => item.id === initialItemId) ? initialItemId : fallbackId
  const [activeId, setActiveId] = useState<string | null>(startingId)

  const activeIndex = useMemo(() => items.findIndex((item) => item.id === activeId), [activeId, items])
  const activeItem = activeIndex >= 0 ? items[activeIndex] : items[0] ?? null

  function selectRelative(offset: number) {
    if (items.length === 0 || activeIndex < 0) return
    const nextIndex = Math.min(items.length - 1, Math.max(0, activeIndex + offset))
    setActiveId(items[nextIndex]?.id ?? activeId)
  }

  if (!activeItem) {
    return null
  }

  return (
    <section className="qv-feature-showcase">
      <div className="qv-feature-showcase-head">
        <div className="qv-feature-showcase-copy">
          {eyebrow ? <p className="qv-eyebrow">{eyebrow}</p> : null}
          <h1 className="qv-title qv-feature-showcase-title">{title}</h1>
          {intro ? <p className="qv-subtitle qv-feature-showcase-intro">{intro}</p> : null}
        </div>
      </div>

      <div className="qv-feature-showcase-body">
        <div className="qv-feature-showcase-stage" aria-live="polite">
          <div className="qv-feature-showcase-stage-inner">{activeItem.panelContent}</div>
        </div>

        <div className="qv-feature-showcase-rail">
          <div className="qv-feature-showcase-rail-list" role="tablist" aria-label={`${title} feature list`}>
            {items.map((item) => {
              const isActive = item.id === activeItem.id

              return (
                <div
                  key={item.id}
                  className={`qv-feature-showcase-item${isActive ? ' is-active' : ''}`}
                  data-state={isActive ? 'active' : 'idle'}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-expanded={isActive}
                    className="qv-feature-showcase-trigger"
                    onClick={() => setActiveId(item.id)}
                  >
                    <span className="qv-feature-showcase-trigger-icon" aria-hidden="true">
                      {isActive ? '−' : '+'}
                    </span>
                    <span className="qv-feature-showcase-trigger-label">{item.label}</span>
                  </button>

                  {isActive ? (
                    <div className="qv-feature-showcase-detail" role="tabpanel">
                      <h2 className="qv-feature-showcase-detail-title">{item.title}</h2>
                      <p className="qv-feature-showcase-detail-copy">{item.description}</p>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>

          <div className="qv-feature-showcase-nav">
            <button
              type="button"
              className="qv-button-secondary qv-feature-showcase-nav-button"
              onClick={() => selectRelative(-1)}
              disabled={activeIndex <= 0}
            >
              Previous
            </button>
            <button
              type="button"
              className="qv-button-secondary qv-feature-showcase-nav-button"
              onClick={() => selectRelative(1)}
              disabled={activeIndex >= items.length - 1}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
