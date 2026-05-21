'use client'

export default function CustomizationToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="ccic-mini-check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span>{checked ? '✓ Custom logo/text' : '✕ No custom logo/text'}</span>
    </label>
  )
}
