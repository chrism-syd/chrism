export type LocalUnitKind = 'council' | 'parish' | 'conference' | 'ministry' | 'other'

export type LocalUnitTerminology = {
  singular: string
  plural: string
  numberLabel: string | null
  genericSingular: string
  genericPlural: string
}

export const DEFAULT_LOCAL_UNIT_TERMINOLOGY = {
  singular: 'Local organization',
  plural: 'Local organizations',
  numberLabel: null,
  genericSingular: 'local organization',
  genericPlural: 'local organizations',
} as const satisfies LocalUnitTerminology

const LOCAL_UNIT_TERMINOLOGY_BY_KIND = {
  council: {
    singular: 'Council',
    plural: 'Councils',
    numberLabel: 'Council number',
    genericSingular: 'council',
    genericPlural: 'councils',
  },
  parish: {
    singular: 'Parish',
    plural: 'Parishes',
    numberLabel: null,
    genericSingular: 'parish',
    genericPlural: 'parishes',
  },
  conference: {
    singular: 'Conference',
    plural: 'Conferences',
    numberLabel: 'Conference number',
    genericSingular: 'conference',
    genericPlural: 'conferences',
  },
  ministry: {
    singular: 'Ministry',
    plural: 'Ministries',
    numberLabel: null,
    genericSingular: 'ministry',
    genericPlural: 'ministries',
  },
  other: DEFAULT_LOCAL_UNIT_TERMINOLOGY,
} as const satisfies Record<LocalUnitKind, LocalUnitTerminology>

export function isLocalUnitKind(value: string | null | undefined): value is LocalUnitKind {
  return value === 'council' || value === 'parish' || value === 'conference' || value === 'ministry' || value === 'other'
}

export function getLocalUnitTerminology(kind: string | null | undefined): LocalUnitTerminology {
  if (!isLocalUnitKind(kind)) {
    return DEFAULT_LOCAL_UNIT_TERMINOLOGY
  }

  return LOCAL_UNIT_TERMINOLOGY_BY_KIND[kind]
}

export function formatLocalUnitNumberLabel(kind: string | null | undefined) {
  return getLocalUnitTerminology(kind).numberLabel ?? 'Local organization number'
}

export function formatLocalUnitMismatchMessage(args: {
  kind: string | null | undefined
  actualIdentifier: string | number | null | undefined
}) {
  const terminology = getLocalUnitTerminology(args.kind)
  const identifier = args.actualIdentifier ?? '—'

  return `This row belongs to ${terminology.genericSingular} ${identifier} and will stay skipped for this ${terminology.genericSingular} import.`
}
