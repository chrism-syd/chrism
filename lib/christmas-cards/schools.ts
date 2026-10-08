export type CcicSchoolCampaign = {
  slug: string
  code: string
  name: string
  active: boolean
  orderingClosesAt?: string
  deliveryBy?: string
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
  {
    slug: 'st-francis-xavier',
    code: 'STFRANCISXAVIER26',
    name: 'St. Francis Xavier',
    active: true,
    orderingClosesAt: '2026-11-15T23:59:59-05:00',
    deliveryBy: '2026-11-30',
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


export function isCcicSchoolCampaignOpen(school: CcicSchoolCampaign, now = new Date()) {
  if (!school.active) return false
  if (!school.orderingClosesAt) return true
  return now.getTime() <= new Date(school.orderingClosesAt).getTime()
}


export function formatCcicSchoolCampaignDate(value?: string) {
  if (!value) return null
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00Z`)
    : new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('en-CA', {
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Toronto',
  }).format(date)
}
