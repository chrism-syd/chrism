export type CcicSchoolCampaign = {
  slug: string
  code: string
  name: string
  active: boolean
}

// Year-one school registry.
// Add one entry per participating school. The slug becomes the public URL:
// ccic.supplies/schools/<slug>
export const CCIC_SCHOOL_CAMPAIGNS: CcicSchoolCampaign[] = [
  {
    slug: 'san-lorenzo-ruiz',
    code: 'SANLORENZO26',
    name: 'San Lorenzo Ruiz',
    active: true,
  },
  {
    slug: 'st-edward',
    code: 'STEDWARD26',
    name: 'St. Edward',
    active: true,
  },
  {
    slug: 'st-patrick',
    code: 'STPATRICK26',
    name: 'St. Patrick',
    active: true,
  },
  {
    slug: 'all-saints',
    code: 'ALLSAINTS26',
    name: 'All Saints',
    active: true,
  },
  {
    slug: 'st-brother-andre-high-school',
    code: 'STBROTHERANDRE26',
    name: 'St. Brother Andre High School',
    active: true,
  },
]

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
