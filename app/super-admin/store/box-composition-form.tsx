'use client'

import Image from 'next/image'
import { useActionState, useState } from 'react'
import {
  type BoxCompositionActionState,
  updateChristmasCardBoxCompositionStateAction,
} from './box-composition-actions'

type CardDesignInput = {
  id: string
  title: string
  sku: string | null
  styleFamily: string | null
  quantity: number
  thumbnailUrl: string | null
}

type Props = {
  boxProductId: string
  currentTotal: number
  designs: CardDesignInput[]
}

const initialBoxCompositionActionState: BoxCompositionActionState = {
  status: 'idle',
  message: null,
}

function DesignThumbnail({ title, thumbnailUrl }: { title: string; thumbnailUrl: string | null }) {
  const [hasImageError, setHasImageError] = useState(false)

  if (!thumbnailUrl?.startsWith('/') || hasImageError) {
    return <div className="ccic-admin-design-thumbnail ccic-admin-case-thumbnail-empty" aria-hidden="true" />
  }

  return (
    <div className="ccic-admin-design-thumbnail">
      <Image
        src={thumbnailUrl}
        alt={`${title} preview`}
        width={72}
        height={96}
        onError={() => setHasImageError(true)}
      />
    </div>
  )
}

export default function BoxCompositionForm({ boxProductId, currentTotal, designs }: Props) {
  const [state, formAction] = useActionState(updateChristmasCardBoxCompositionStateAction, initialBoxCompositionActionState)
  const displayedTotal = typeof state.totalCards === 'number' ? state.totalCards : currentTotal

  return (
    <form action={formAction} className="qv-form-grid ccic-admin-form ccic-admin-box-composition-form">
      <input type="hidden" name="box_product_id" value={boxProductId} />
      <div className="ccic-admin-note">
        <strong>Box composition</strong>
        <span>
          This 12-pack currently includes {displayedTotal} cards. Use the card design quantities below to curate this box.
        </span>
      </div>

      {state.status === 'error' && state.message ? (
        <section className="qv-inline-message qv-inline-error" aria-live="polite">
          <p style={{ margin: 0 }}>{state.message}</p>
        </section>
      ) : null}
      {state.status === 'success' && state.message ? (
        <section className="qv-inline-message qv-inline-success" aria-live="polite">
          <p style={{ margin: 0 }}>{state.message}</p>
        </section>
      ) : null}

      <div className="ccic-admin-design-rows">
        {designs.map((design) => (
          <div key={design.id} className="ccic-admin-design-row">
            <DesignThumbnail title={design.title} thumbnailUrl={design.thumbnailUrl} />
            <div className="ccic-admin-design-row-body">
              <label className="qv-field ccic-admin-quantity-field">
                <span>{design.title}</span>
                <input
                  name={`quantity_${design.id}`}
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={design.quantity}
                />
              </label>
              <div className="ccic-admin-row-meta">
                <span>{design.sku ?? 'No SKU'}{design.styleFamily ? ` • ${design.styleFamily}` : ''}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="qv-form-actions">
        <button type="submit" className="qv-button-secondary">Save box composition</button>
      </div>
    </form>
  )
}
