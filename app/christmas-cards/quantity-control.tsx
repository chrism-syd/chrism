'use client'

export function clampChristmasCardQuantity(value: number, max = 999) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(Math.max(0, Math.floor(max)), Math.floor(value)))
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
  max = 999,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  max?: number
}) {
  const normalizedMax = Math.max(0, Math.floor(max))

  return (
    <div className="ccic-quantity" aria-label={label}>
      <button type="button" onClick={() => onChange(clampChristmasCardQuantity(value - 1, normalizedMax))} disabled={value <= 0} aria-label={`Remove one ${label}`}>
        -
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        pattern="[0-9]*"
        min={0}
        max={normalizedMax}
        value={value}
        onChange={(event) => onChange(clampChristmasCardQuantity(Number(event.target.value), normalizedMax))}
      />
      <button
        type="button"
        onClick={() => onChange(clampChristmasCardQuantity(value + 1, normalizedMax))}
        disabled={value >= normalizedMax}
        aria-label={`Add one ${label}`}
      >
        +
      </button>
    </div>
  )
}
