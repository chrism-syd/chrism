export function applyNonBreakingTextRules(value: string): string
export function applyNonBreakingTextRules(value: string | null | undefined): string | null
export function applyNonBreakingTextRules(value: string | null | undefined) {
  if (!value) return null

  return value.replace(/\bSt\.\s+/g, 'St.\u00a0')
}
