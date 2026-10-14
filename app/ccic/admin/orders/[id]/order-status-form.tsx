'use client'

import { useRef, type FormEvent } from 'react'
import {
  CCIC_ORDER_STATUSES,
  CCIC_ORDER_STATUS_LABELS,
  type CcicOrderStatus,
} from '@/lib/christmas-cards/admin-order-status'
import { updateCcicOrderStatus } from '../actions'

type Props = {
  orderId: string
  initialStatus: CcicOrderStatus
  deliveredAt: string | null
}

export default function CcicOrderStatusForm({ orderId, initialStatus, deliveredAt }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const statusRef = useRef<HTMLSelectElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const confirmedRef = useRef(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (statusRef.current?.value !== 'delivered' || confirmedRef.current) return

    event.preventDefault()
    dialogRef.current?.showModal()
  }

  function proceed() {
    confirmedRef.current = true
    dialogRef.current?.close()
    formRef.current?.requestSubmit()
  }

  return (
    <>
      <form ref={formRef} action={updateCcicOrderStatus} onSubmit={handleSubmit} className="ccic-admin-status-form">
        <input type="hidden" name="order_id" value={orderId} />
        <label htmlFor="status">Update workflow status</label>
        <div>
          <select ref={statusRef} id="status" name="status" defaultValue={initialStatus}>
            {CCIC_ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>{CCIC_ORDER_STATUS_LABELS[status]}</option>
            ))}
          </select>
          <button type="submit">Save status</button>
        </div>
      </form>

      <dialog
        ref={dialogRef}
        className="ccic-admin-delivery-dialog"
        aria-labelledby="ccic-delivery-confirm-title"
        aria-describedby="ccic-delivery-confirm-description"
      >
        <h3 id="ccic-delivery-confirm-title">Confirm delivery status</h3>
        <p id="ccic-delivery-confirm-description">
          {deliveredAt
            ? 'This will overwrite the existing Delivered date and time with the current date and time. The previous timestamp will not be retained.'
            : 'This will mark the order as Delivered and record the current date and time.'}
        </p>
        <p>Do you want to proceed?</p>
        <div className="ccic-admin-delivery-dialog-actions">
          <button type="button" onClick={() => dialogRef.current?.close()}>Cancel</button>
          <button type="button" onClick={proceed}>Proceed</button>
        </div>
      </dialog>
    </>
  )
}
