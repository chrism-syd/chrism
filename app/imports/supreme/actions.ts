'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context';
import { protectPeoplePayload } from '@/lib/security/pii';
import { normalizeSupremeImportTextField } from '@/lib/imports/supreme-text-normalization';
import type { ImportFieldKey } from '@/lib/imports/supreme';

type ApplyImportRowPayload = {
  rowId: string;
  sourceRowNumber: number;
  councilNumber: string | null;
  existingPersonId: string | null;
  importMode: 'update_existing' | 'create_new';
  fieldValues: Record<ImportFieldKey, string | null>;
};

type ApplyImportPayload = {
  rows: ApplyImportRowPayload[];
};

type ProtectedPersonPayload = ReturnType<typeof buildProtectedPersonPayload>;
type KofcProfilePayload = ReturnType<typeof buildKofcProfilePayload>;

type ApplySupremeImportRowResult = {
  person_id: string;
  action: 'created' | 'updated';
};

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeInteger(value: string | null | undefined) {
  const text = normalizeText(value);
  if (!text) return null;

  const parsed = Number(text);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeDate(value: string | null | undefined) {
  const text = normalizeText(value);
  if (!text) return null;
  return text;
}

function omitNullish<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== null && value !== undefined)
  ) as Partial<T>;
}

function normalizeSupremeField(
  field:
    | 'title'
    | 'first_name'
    | 'middle_name'
    | 'last_name'
    | 'suffix'
    | 'email'
    | 'address_line_1'
    | 'city'
    | 'state_province'
    | 'postal_code'
    | 'supreme_member_type'
    | 'supreme_member_class',
  value: string | null | undefined
) {
  return normalizeSupremeImportTextField(field, value);
}

function buildProtectedPersonPayload(row: ApplyImportRowPayload) {
  const values = row.fieldValues;

  return protectPeoplePayload({
    title: normalizeSupremeField('title', values.title),
    first_name: normalizeSupremeField('first_name', values.first_name),
    middle_name: normalizeSupremeField('middle_name', values.middle_name),
    last_name: normalizeSupremeField('last_name', values.last_name),
    suffix: normalizeSupremeField('suffix', values.suffix),
    email: normalizeSupremeField('email', values.email),
    cell_phone: normalizeText(values.cell_phone),
    address_line_1: normalizeSupremeField('address_line_1', values.address_line_1),
    city: normalizeSupremeField('city', values.city),
    state_province: normalizeSupremeField('state_province', values.state_province),
    postal_code: normalizeSupremeField('postal_code', values.postal_code),
    birth_date: normalizeDate(values.birth_date),
    council_activity_level_code: normalizeText(values.council_activity_level_code),
  });
}

function buildKofcProfilePayload(row: ApplyImportRowPayload) {
  const values = row.fieldValues;

  return omitNullish({
    first_degree_date: normalizeDate(values.first_degree_date),
    second_degree_date: normalizeDate(values.second_degree_date),
    third_degree_date: normalizeDate(values.third_degree_date),
    years_in_service: normalizeInteger(values.years_of_service),
    member_type: normalizeSupremeField('supreme_member_type', values.supreme_member_type),
    member_class: normalizeSupremeField('supreme_member_class', values.supreme_member_class),
    assembly_number: normalizeText(values.assembly_number),
  });
}

function getStringValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'string' ? value : null;
}

function getNullableNumberValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === 'number' ? value : null;
}

function buildRpcArguments(args: {
  row: ApplyImportRowPayload;
  councilId: string;
  organizationId: string;
  authUserId: string;
}) {
  const { row, councilId, organizationId, authUserId } = args;
  const personPayload = buildProtectedPersonPayload(row) as ProtectedPersonPayload &
    Record<string, unknown>;
  const kofcProfilePayload = buildKofcProfilePayload(row) as KofcProfilePayload &
    Record<string, unknown>;

  return {
    p_council_id: councilId,
    p_organization_id: organizationId,
    p_auth_user_id: authUserId,
    p_import_mode: row.importMode,
    p_existing_person_id: row.existingPersonId,
    p_council_number: normalizeText(row.councilNumber),
    p_title: getStringValue(personPayload, 'title'),
    p_first_name: getStringValue(personPayload, 'first_name'),
    p_middle_name: getStringValue(personPayload, 'middle_name'),
    p_last_name: getStringValue(personPayload, 'last_name'),
    p_suffix: getStringValue(personPayload, 'suffix'),
    p_email: getStringValue(personPayload, 'email'),
    p_email_hash: getStringValue(personPayload, 'email_hash'),
    p_cell_phone: getStringValue(personPayload, 'cell_phone'),
    p_cell_phone_hash: getStringValue(personPayload, 'cell_phone_hash'),
    p_address_line_1: getStringValue(personPayload, 'address_line_1'),
    p_address_line_1_hash: getStringValue(personPayload, 'address_line_1_hash'),
    p_city: getStringValue(personPayload, 'city'),
    p_city_hash: getStringValue(personPayload, 'city_hash'),
    p_state_province: getStringValue(personPayload, 'state_province'),
    p_state_province_hash: getStringValue(personPayload, 'state_province_hash'),
    p_postal_code: getStringValue(personPayload, 'postal_code'),
    p_postal_code_hash: getStringValue(personPayload, 'postal_code_hash'),
    p_birth_date: getStringValue(personPayload, 'birth_date'),
    p_birth_date_hash: getStringValue(personPayload, 'birth_date_hash'),
    p_pii_key_version: getStringValue(personPayload, 'pii_key_version'),
    p_council_activity_level_code: getStringValue(personPayload, 'council_activity_level_code'),
    p_member_number: normalizeText(row.fieldValues.member_number),
    p_first_degree_date: getStringValue(kofcProfilePayload, 'first_degree_date'),
    p_second_degree_date: getStringValue(kofcProfilePayload, 'second_degree_date'),
    p_third_degree_date: getStringValue(kofcProfilePayload, 'third_degree_date'),
    p_years_in_service: getNullableNumberValue(kofcProfilePayload, 'years_in_service'),
    p_member_type: getStringValue(kofcProfilePayload, 'member_type'),
    p_member_class: getStringValue(kofcProfilePayload, 'member_class'),
    p_assembly_number: getStringValue(kofcProfilePayload, 'assembly_number'),
  };
}

export async function applySupremeImportAction(payload: ApplyImportPayload) {
  const { admin, permissions, council } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/imports/supreme',
  });

  if (!permissions.authUser) {
    throw new Error('You must be signed in.');
  }

  if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
    throw new Error('No import rows were provided.');
  }

  if (!council.organization_id) {
    throw new Error('This council is not linked to an organization.');
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const row of payload.rows) {
    const firstName = normalizeText(row.fieldValues.first_name);
    const lastName = normalizeText(row.fieldValues.last_name);

    if (!firstName || !lastName) {
      continue;
    }

    const rpcArgs = buildRpcArguments({
      row,
      councilId: council.id,
      organizationId: council.organization_id,
      authUserId: permissions.authUser.id,
    });

    const { data, error } = await admin.rpc('apply_supreme_import_row', rpcArgs);

    if (error) {
      throw new Error(`Row ${row.sourceRowNumber}: ${error.message}`);
    }

    const result = data as ApplySupremeImportRowResult | null;

    if (result?.action === 'updated') {
      updatedCount += 1;
      continue;
    }

    createdCount += 1;
  }

  revalidatePath('/');
  revalidatePath('/members');
  revalidatePath('/imports/supreme');

  return {
    appliedCount: createdCount + updatedCount,
    createdCount,
    updatedCount,
  };
}
