'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'
import {
  type BoxStockActionState,
  updateCardBoxStockStateAction,
} from './box-stock-actions'

type Props = {
  productId: string
  initialBoxesLeft: number | null
}

const initialBoxStockActionState: BoxStockActionState = {
  status: 'idle',
  message: null,
}

function valueFromBoxesLeft(value: number | null | undefined) {
  return typeof value === 'number' ? String(value) : ''
}

export default function BoxStockForm({ productId, initialBoxesLeft }: Props) {
  const router = useRouter()
  const [state, formAction] = useActionState(updateCardBoxStockStateAction, initialBoxStockActionState)
  const [inputValue, setInputValue] = useState(valueFromBoxesLeft(initialBoxesLeft))

  useEffect(() => {
    if (state.status !== 'success') return
    setInputValue(valueFromBoxesLeft(state.boxesLeft))
    router.refresh()
  }, [router, state.boxesLeft, state.status])

  return (
    <form action={formAction} className="ccic-admin-stock-form">
      <input type="hidden" name="product_id" value={productId} />
      <label className="qv-field ccic-admin-stock-field">
        <span>Boxes left, admin only</span>
        <input
          name="boxes_left_count"
          type="number"
          min="0"
          step="1"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder="Not set"
        />
      </label>
      <button type="submit" className="qv-button-secondary">Save boxes left</button>

      {state.status === 'error' && state.message ? (
        <p className="ccic-admin-stock-message ccic-admin-stock-error" aria-live="polite">{state.message}</p>
      ) : null}
      {state.status === 'success' && state.message ? (
        <p className="ccic-admin-stock-message ccic-admin-stock-success" aria-live="polite">{state.message}</p>
      ) : null}
    </form>
  )
}
