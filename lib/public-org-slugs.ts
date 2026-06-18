type CouncilSlugInput = {
  name?: string | null
  councilNumber?: string | null
}

export function slugifyPublicOrgName(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function extractTrailingCouncilNumber(slug: string | null | undefined) {
  const match = (slug ?? '').match(/(?:^|-)(\d+)$/)
  return match?.[1] ?? null
}

export function buildCouncilPublicOrgSlug(input: CouncilSlugInput) {
  const councilNumber = input.councilNumber?.trim() || null
  const base = slugifyPublicOrgName(input.name) || (councilNumber ? `council-${councilNumber}` : 'local-organization')

  if (!councilNumber) return base
  if (base.endsWith(`-${councilNumber}`) || base === councilNumber) return base

  return `${base}-${councilNumber}`
}
