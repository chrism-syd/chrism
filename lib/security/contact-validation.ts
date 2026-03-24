export function isValidEmailAddress(value: string | null | undefined) {
  if (!value) {
    return true
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
