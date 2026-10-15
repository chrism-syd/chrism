'use client'

type SchoolPrintButtonProps = {
  label: string
}

export default function SchoolPrintButton({ label }: SchoolPrintButtonProps) {
  return (
    <button
      className="ccic-school-print-button"
      type="button"
      onClick={() => window.print()}
    >
      {label}
    </button>
  )
}
