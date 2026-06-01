'use client'

import Image from 'next/image'
import { useActionState, useState } from 'react'
import {
  type CaseCompositionActionState,
  updateChristmasCardCaseCompositionStateAction,
} from './case-composition-actions'

type CardBoxInput = {
  id: string
  title: string
  sku: string | null
  priceLabel: string
  quantity: number
  thumbnailUrl: string | null
}

type Props = {
  caseProductId: string
  currentTotal: number
  cardBoxes: CardBoxInput[]
}

const initialCaseCompositionActionState: CaseCompositionActionState = {
  status: 'idle',
  message: null,
}

function CaseBoxThumbnail({ title, thumbnailUrl }: { title: string; thumbnailUrl: string | null }) {
  const [hasImageError, setHasImageError] = useState(false)

  if (!thumbnailUrl?.startsWith('/') || hasImageError) {
    return <div className="ccic-admin-case-thumbnail ccic-admin-case-thumbnail-empty" aria-hidden="true" />
  }

  return (
    <div className="ccic-admin-case-thumbnail">
      <Image
        src={thumbnailUrl}
        alt={`${title} preview`}
        width={96}
        height={72}
        onError={() => setHasImageError(true)}
      />
    </div>
  )
}

export default function CaseCompositionForm({ caseProductId, currentTotal, cardBoxes }: Props) {
  const [state, formAction] = useActionState(updateChristmasCardCaseCompositionStateAction, initialCaseCompositionActionState)
  const displayedTotal = state.status === 'success' && typeof state.totalBoxes === 'number' ? state.totalBoxes : currentTotal

  return (
    <form action={formAction} className="qv-form-grid ccic-admin-form" style={{ marginTop: 16 }}>
      <input type="hidden" name="case_product_id" value={caseProductId} />
      <div className="ccic-admin-note">
        <strong>Case composition</strong>
        <span>
          This case currently includes {displayedTotal} boxes. Saving will update the case box count to the submitted total.
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

      <div className="ccic-admin-case-rows">
        {cardBoxes.map((box) => (
          <div key={box.id} className="ccic-admin-case-row">
            <CaseBoxThumbnail title={box.title} thumbnailUrl={box.thumbnailUrl} />

            <div className="ccic-admin-case-row-body">
              <label className="qv-field ccic-admin-quantity-field">
                <span>{box.title}</span>
                <input
                  name={`quantity_${box.id}`}
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={box.quantity}
                />
              </label>
              <div className="ccic-admin-row-meta">
                <span>{box.sku ?? 'No SKU'} • {box.priceLabel} per box</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <label className="qv-field">
        <span>Confirmation</span>
        <span className="ccic-admin-confirmation">
          <input name="confirm_case_box_total" type="checkbox" /> I understand this will change the number of boxes included in this case.
        </span>
      </label>

      <div className="qv-form-actions">
        <button type="submit" className="qv-button-secondary">Save case composition</button>
      </div>
    </form>
  )
}
