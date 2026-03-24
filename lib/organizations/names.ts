export type OrganizationNameRecord = {
  preferred_name?: string | null;
  display_name?: string | null;
};

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getEffectiveOrganizationName(organization?: OrganizationNameRecord | null) {
  return normalizeText(organization?.preferred_name) ?? normalizeText(organization?.display_name) ?? null;
}

export function getOrganizationContextLabel({
  organization,
  fallbackName,
  unitNumber,
  fallbackLabel = 'Organization',
}: {
  organization?: OrganizationNameRecord | null;
  fallbackName?: string | null;
  unitNumber?: string | null;
  fallbackLabel?: string;
}) {
  const baseName =
    getEffectiveOrganizationName(organization) ?? normalizeText(fallbackName) ?? normalizeText(fallbackLabel) ?? 'Organization';
  const normalizedNumber = normalizeText(unitNumber);

  if (!normalizedNumber) {
    return baseName;
  }

  if (baseName.toLowerCase().includes(normalizedNumber.toLowerCase())) {
    return baseName;
  }

  return `${baseName} (${normalizedNumber})`;
}
