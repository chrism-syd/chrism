'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context';
import {
  formatOfficerLabel,
  getOfficerRoleOption,
  type OfficerScopeCode,
} from '@/lib/members/officer-roles';

function textEntry(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function redirectToPath(path: string, args: { error?: string | null; notice?: string | null }): never {
  const params = new URLSearchParams();

  if (args.error) {
    params.set('error', args.error);
  }

  if (args.notice) {
    params.set('notice', args.notice);
  }

  redirect(params.size > 0 ? `${path}?${params.toString()}` : path);
}

async function requireCouncilAdmin() {
  const { permissions, council, admin } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/members',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  });

  return {
    permissions: { ...permissions, councilId: council.id },
    admin,
  };
}

function rangesOverlap(
  first: { start: number; end: number | null },
  second: { start: number; end: number | null }
) {
  const firstEnd = first.end ?? Number.MAX_SAFE_INTEGER;
  const secondEnd = second.end ?? Number.MAX_SAFE_INTEGER;
  return first.start <= secondEnd && second.start <= firstEnd;
}

function formatYearRange(startYear: number, endYear: number | null) {
  return endYear == null ? `${startYear} to present` : `${startYear} to ${endYear}`;
}

function revalidateOfficerSurfaces(personId: string) {
  revalidatePath('/members');
  revalidatePath('/members/officers');
  revalidatePath(`/members/${personId}`);
  revalidatePath(`/members/${personId}/edit`);
  revalidatePath(`/members/${personId}/officers`);
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
  const { permissions, admin } = await requireCouncilAdmin();
  const nextFormData = buildCouncilOfficerActionFormData(formData);
  const personId = textEntry(nextFormData, 'person_id');
  const officeScopeCode = textEntry(nextFormData, 'office_scope_code') as OfficerScopeCode | null;
  const officeCode = textEntry(nextFormData, 'office_code');
  const startYearValue = textEntry(nextFormData, 'service_start_year');
  const endYearValue = textEntry(nextFormData, 'service_end_year');
  const rankValue = textEntry(nextFormData, 'office_rank');
  const returnTo = textEntry(nextFormData, 'return_to') ?? '/me/council';

  if (!personId || !officeScopeCode || !officeCode || !startYearValue) {
    redirectToPath(returnTo, { error: 'Please choose the member, office, and start year before saving.' });
  }

  const startYear = Number(startYearValue);
  const endYear = endYearValue ? Number(endYearValue) : null;
  const rank = rankValue ? Number(rankValue) : null;
  const option = getOfficerRoleOption(officeScopeCode as OfficerScopeCode, officeCode as string);

  const { data: existingTerms, error: existingTermsError } = await admin
    .from('person_officer_terms')
    .select('id, office_scope_code, office_code, office_label, office_rank, service_start_year, service_end_year')
    .eq('council_id', permissions.councilId!)
    .eq('person_id', personId as string);

  if (existingTermsError) {
    redirectToPath(returnTo, { error: existingTermsError.message });
  }

  const overlappingTerm = (existingTerms ?? []).find((term) =>
    rangesOverlap(
      { start: startYear, end: endYear },
      { start: term.service_start_year, end: term.service_end_year }
    )
  );

  if (overlappingTerm) {
    const overlappingLabel = formatOfficerLabel(overlappingTerm);
    const overlappingYears = formatYearRange(
      overlappingTerm.service_start_year,
      overlappingTerm.service_end_year
    );

    redirectToPath(returnTo, {
      error:
        `This member already has an officer term during ${overlappingYears} (${overlappingLabel}). A member can only hold one officer role at a time.`,
    });
  }

  const payload = {
    council_id: permissions.councilId!,
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
    redirectToPath(returnTo, { error: error.message });
  }

  revalidateOfficerSurfaces(personId as string);
  redirectToPath(returnTo, { notice: 'Officer term saved.' });
}

export async function deleteOfficerTermAction(formData: FormData) {
  const { permissions, admin } = await requireCouncilAdmin();
  const termId = textEntry(formData, 'term_id');
  const personId = textEntry(formData, 'person_id');
  const returnTo = textEntry(formData, 'return_to') ?? (personId ? `/members/${personId}/edit` : '/members');

  if (!termId || !personId) {
    redirectToPath(returnTo, { error: 'We could not tell which officer term to remove.' });
  }

  const { error } = await admin
    .from('person_officer_terms')
    .delete()
    .eq('id', termId as string)
    .eq('person_id', personId as string)
    .eq('council_id', permissions.councilId!);

  if (error) {
    redirectToPath(returnTo, { error: error.message });
  }

  revalidateOfficerSurfaces(personId as string);
  redirectToPath(returnTo, { notice: 'Officer term removed.' });
}
