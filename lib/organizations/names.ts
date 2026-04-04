export type OrganizationNameRecord = {
  preferred_name?: string | null;
  display_name?: string | null;
};

export type BrandProfileRecord = {
  code?: string | null;
  display_name?: string | null;
  logo_storage_bucket?: string | null;
  logo_storage_path?: string | null;
  logo_alt_text?: string | null;
};

export type OrganizationBrandingRecord = OrganizationNameRecord & {
  id?: string | null;
  logo_storage_bucket?: string | null;
  logo_storage_path?: string | null;
  logo_alt_text?: string | null;
  brand_profile?: BrandProfileRecord | null;
};

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getEffectiveOrganizationName(organization?: OrganizationNameRecord | null) {
  return normalizeText(organization?.preferred_name) ?? normalizeText(organization?.display_name) ?? null;
}

export function getEffectiveOrganizationBranding(organization?: OrganizationBrandingRecord | null) {
  const ownLogoStoragePath = normalizeText(organization?.logo_storage_path);
  const ownLogoAltText = normalizeText(organization?.logo_alt_text);

  if (ownLogoStoragePath) {
    return {
      logo_storage_path: ownLogoStoragePath,
      logo_alt_text: ownLogoAltText ?? getEffectiveOrganizationName(organization) ?? null,
    };
  }

  const brandProfileLogoPath = normalizeText(organization?.brand_profile?.logo_storage_path);
  const brandProfileLogoAltText = normalizeText(organization?.brand_profile?.logo_alt_text);

  if (brandProfileLogoPath) {
    return {
      logo_storage_path: brandProfileLogoPath,
      logo_alt_text:
        ownLogoAltText ??
        brandProfileLogoAltText ??
        getEffectiveOrganizationName(organization) ??
        normalizeText(organization?.brand_profile?.display_name) ??
        null,
    };
  }

  return {
    logo_storage_path: null,
    logo_alt_text:
      ownLogoAltText ??
      brandProfileLogoAltText ??
      getEffectiveOrganizationName(organization) ??
      normalizeText(organization?.brand_profile?.display_name) ??
      null,
  };
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
