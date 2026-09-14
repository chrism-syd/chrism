export type CcicSchoolCampaign = {
  slug: string
  code: string
  name: string
  active: boolean
}

// Year-one school registry.
// Add one entry per participating school. The slug becomes the public URL:
// ccic.supplies/schools/<slug>
//
// Example:
// {
//   slug: 'st-justin-martyr',
//   code: 'STJUSTIN26',
//   name: 'St. Justin Martyr Catholic Elementary School',
//   active: true,
// },
export const CCIC_SCHOOL_CAMPAIGNS: CcicSchoolCampaign[] = []

export function getCcicSchoolCampaign(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase()
  return CCIC_SCHOOL_CAMPAIGNS.find(
    (school) => school.active && school.slug.toLowerCase() === normalizedSlug
  ) ?? null
}

export function getCcicSchoolCampaignByCode(code: string) {
  const normalizedCode = code.trim().toUpperCase()
  return CCIC_SCHOOL_CAMPAIGNS.find(
    (school) => school.active && school.code.toUpperCase() === normalizedCode
  ) ?? null
}
