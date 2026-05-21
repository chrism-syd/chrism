'use client'

export function clampChristmasCardQuantity(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(999, Math.floor(value)))
}

export function quantityFromMap(map: Record<string, number>, key: string) {
  return clampChristmasCardQuantity(map[key] ?? 0)
}

export function setQuantityValue(map: Record<string, number>, key: string, value: number) {
  return {
    ...map,
    [key]: clampChristmasCardQuantity(value),
  }
}

export default function QuantityControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="ccic-quantity" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 0} aria-label={`Remove one ${label}`}>
        -
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <button type="button" onClick={() => onChange(value + 1)} aria-label={`Add one ${label}`}>
        +
      </button>
    </div>
  )
}
