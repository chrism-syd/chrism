'use client'

export default function PackingListPrintButton() {
  return (
    <button type="button" className="ccic-admin-print-button" onClick={() => window.print()}>
      Print packing list
    </button>
  )
}
