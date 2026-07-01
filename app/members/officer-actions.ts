'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentActingCouncilContext, type ActingCouncilRow } from '@/lib/auth/acting-context';
import { setFlashMessage } from '@/lib/flash-messages';
import {
  formatOfficerLabel,
  getOfficerRoleOption,
  type OfficerScopeCode,
} from '@/lib/members/officer-roles';
import {
  buildReportingYearTermRange,
  getDefaultReportingYearSettings,
  reportingYearTermRangesOverlap,
  type ReportingYearSettings,
} from '@/lib/reporting-years';
import type { createAdminClient } from '@/lib/supabase/admin';

type OrganizationRow = {
  org_type_code: string | null;
};

function textEntry(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeInternalRedirectPath(path: string | null | undefined) {
  const trimmed = path?.trim() ?? '';
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '/people';
  }

  return trimmed;
}

async function redirectToPath(path: string, args: { error?: string | null; notice?: string | null }): Promise<never> {
  const redirectPath = normalizeInternalRedirectPath(path);

  if (args.error) {
    await setFlashMessage('error', args.error, redirectPath);
  } else if (args.notice) {
    await setFlashMessage('notice', args.notice, redirectPath);
  }

  redirect(redirectPath);
}

async function requireCouncilAdmin() {
  const { permissions, council, admin, localUnitId } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/people',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  });

  if (!localUnitId) {
    await redirectToPath('/people', {
      error: 'This view is missing its active local organization context. Refresh and try again.',
    });
  }

  return {
    permissions,
    council,
    admin,
    localUnitId,
    legacyCouncilId: council.id,
  };
}

async function loadReportingYearSettings(args: {
  admin: ReturnType<typeof createAdminClient>;
  council: ActingCouncilRow;
  localUnitId: string | null;
}): Promise<ReportingYearSettings> {
  const [organizationResult, settingsResult] = await Promise.all([
    args.council.organization_id
      ? args.admin
          .from('organizations')
          .select('org_type_code')
          .eq('id', args.council.organization_id)
          .maybeSingle<OrganizationRow>()
      : Promise.resolve({ data: null, error: null }),
    args.localUnitId
      ? args.admin
          .from('local_unit_reporting_year_settings')
          .select('year_label, year_start_month, year_start_day')
          .eq('local_unit_id', args.localUnitId)
          .maybeSingle<ReportingYearSettings>()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const defaultSettings = getDefaultReportingYearSettings(organizationResult.data?.org_type_code ?? null);
  return settingsResult.data ?? defaultSettings;
}

function formatYearRange(startYear: number, endYear: number | null) {
  return endYear == null ? `${startYear} to present` : `${startYear} to ${endYear}`;
}

function revalidateOfficerSurfaces(personId: string) {
  revalidatePath('/people');
  revalidatePath('/people/officers');
  revalidatePath(`/people/${personId}`);
  revalidatePath(`/people/${personId}/edit`);
  revalidatePath(`/people/${personId}/officers`);
  revalidatePath('/me/council');
}

function buildCouncilOfficerActionFormData(formData: FormData) {
  const nextFormData = new FormData();

  for (const [key, value] of formData.entries()) {
    if (key !== 'role_key') {
      nextFormData.append(key, value);
    }
  }

  const roleKey = textEntry(formData, 'role_key');
  if (roleKey) {
    const [officeScopeCode, officeCode] = roleKey.split(':');
    if (officeScopeCode && officeCode) {
      nextFormData.set('office_scope_code', officeScopeCode);
      nextFormData.set('office_code', officeCode);
    }
  }

  return nextFormData;
}

export async function addOfficerTermAction(formData: FormData) {
  const { permissions, council, admin, localUnitId, legacyCouncilId } = await requireCouncilAdmin();
  const nextFormData = buildCouncilOfficerActionFormData(formData);
  const personId = textEntry(nextFormData, 'person_id');
  const officeScopeCode = textEntry(nextFormData, 'office_scope_code') as OfficerScopeCode | null;
  const officeCode = textEntry(nextFormData, 'office_code');
  const startYearValue = textEntry(nextFormData, 'service_start_year');
  const endYearValue = textEntry(nextFormData, 'service_end_year');
  const rankValue = textEntry(nextFormData, 'office_rank');
  const returnTo = textEntry(nextFormData, 'return_to') ?? '/me/council';

  if (!personId || !officeScopeCode || !officeCode || !startYearValue) {
    return await redirectToPath(returnTo, { error: 'Please choose the member, office, and start year before saving.' });
  }

  const startYear = Number(startYearValue);
  const endYear = endYearValue ? Number(endYearValue) : null;
  const rank = rankValue ? Number(rankValue) : null;
  const option = getOfficerRoleOption(officeScopeCode as OfficerScopeCode, officeCode as string);

  const { data: existingTerms, error: existingTermsError } = await admin
    .from('person_officer_terms')
    .select('id, office_scope_code, office_code, office_label, office_rank, service_start_year, service_end_year')
    .eq('local_unit_id', localUnitId)
    .eq('person_id', personId as string);

  if (existingTermsError) {
    return await redirectToPath(returnTo, { error: existingTermsError.message });
  }

  const reportingYearSettings = await loadReportingYearSettings({ admin, council, localUnitId });
  const proposedRange = buildReportingYearTermRange({
    settings: reportingYearSettings,
    startYear,
    endYear,
  });

  const overlappingTerm = (existingTerms ?? []).find((term) =>
    reportingYearTermRangesOverlap(
      proposedRange,
      buildReportingYearTermRange({
        settings: reportingYearSettings,
        startYear: term.service_start_year,
        endYear: term.service_end_year,
      })
    )
  );

  if (overlappingTerm) {
    const overlappingLabel = formatOfficerLabel(overlappingTerm);
    const overlappingYears = formatYearRange(
      overlappingTerm.service_start_year,
      overlappingTerm.service_end_year
    );

    return await redirectToPath(returnTo, {
      error:
        `This member already has an officer term during ${overlappingYears} (${overlappingLabel}). A member can only hold one officer role at a time.`,
    });
  }

  const payload = {
    local_unit_id: localUnitId,
    council_id: legacyCouncilId,
    person_id: personId as string,
    office_scope_code: officeScopeCode as OfficerScopeCode,
    office_code: officeCode as string,
    office_label: formatOfficerLabel({ scope: officeScopeCode, code: officeCode, rank }),
    office_rank: option?.supportsRank ? rank : null,
    service_start_year: startYear,
    service_end_year: endYear,
    notes: textEntry(nextFormData, 'notes'),
    created_by_auth_user_id: permissions.authUser!.id,
    updated_by_auth_user_id: permissions.authUser!.id,
  };

  const { error } = await admin.from('person_officer_terms').insert(payload);

  if (error) {
    return await redirectToPath(returnTo, { error: error.message });
  }

  revalidateOfficerSurfaces(personId as string);
  return await redirectToPath(returnTo, { notice: 'Officer term saved.' });
}

export async function deleteOfficerTermAction(formData: FormData) {
  const { admin, localUnitId } = await requireCouncilAdmin();
  const termId = textEntry(formData, 'term_id');
  const personId = textEntry(formData, 'person_id');
  const returnTo = textEntry(formData, 'return_to') ?? (personId ? `/people/${personId}/edit` : '/people');

  if (!termId || !personId) {
    return await redirectToPath(returnTo, { error: 'We could not tell which officer term to remove.' });
  }

  const { error } = await admin
    .from('person_officer_terms')
    .delete()
    .eq('id', termId as string)
    .eq('person_id', personId as string)
    .eq('local_unit_id', localUnitId);

  if (error) {
    return await redirectToPath(returnTo, { error: error.message });
  }

  revalidateOfficerSurfaces(personId as string);
  return await redirectToPath(returnTo, { notice: 'Officer term removed.' });
}
