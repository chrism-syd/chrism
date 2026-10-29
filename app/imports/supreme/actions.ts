'use server';
import { revalidatePath } from 'next/cache';
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context';
import { loadSupremeImportExistingPeopleForLocalUnit } from '@/lib/imports/supreme-existing-people';
import { IMPORT_FIELD_DEFINITIONS } from '@/lib/imports/supreme';
import type { ApplyImportRowPayload } from '@/lib/imports/supreme-apply';
import { enqueueReview, reviewPerson, type RosterReviewInput } from '@/lib/people-reviews/queue';
import { findPersonMatches } from '@/lib/people-reviews/matching';

export async function applySupremeImportAction(payload: { rows: ApplyImportRowPayload[] }) {
  const { admin, permissions, council, localUnitId } = await getCurrentActingCouncilContext({
    requireAdmin:true, redirectTo:'/imports/supreme', areaCode:'members', minimumAccessLevel:'edit_manage',
  });
  if (!permissions.authUser || !localUnitId || !council.organization_id) throw new Error('An active organization and signed-in administrator are required.');
  if (!Array.isArray(payload.rows) || !payload.rows.length || payload.rows.length > 2000) throw new Error('Submit between 1 and 2,000 rows.');
  const inputs: RosterReviewInput[] = payload.rows.map(row => {
    if (row.councilNumber && row.councilNumber.trim() !== council.council_number) throw new Error(`Row ${row.sourceRowNumber}: council does not match the active organization.`);
    const fieldValues = Object.fromEntries(IMPORT_FIELD_DEFINITIONS.map(field => {
      const value = row.fieldValues?.[field.key];
      if (value != null && (typeof value !== 'string' || value.length > 2000)) throw new Error('An uploaded field is invalid or too long.');
      return [field.key, value?.trim() || null];
    })) as RosterReviewInput['fieldValues'];
    if (!fieldValues.first_name || !fieldValues.last_name) throw new Error(`Row ${row.sourceRowNumber}: first and last name are required.`);
    for (const value of [row.homePhone,row.otherPhone,row.sourceNotes]) if (value!=null && (typeof value!=='string'||value.length>20000)) throw new Error('An uploaded phone or notes field is invalid or too long.');
    return {kind:'roster',sourceRowNumber:row.sourceRowNumber,councilNumber:council.council_number,fieldValues,sourceNotes:row.sourceNotes?.trim()||null,
      home_phone:row.homePhone?.trim() || null,other_phone:row.otherPhone?.trim() || null};
  });
  const people = await loadSupremeImportExistingPeopleForLocalUnit({admin,localUnitId,organizationId:council.organization_id});
  const ids = new Set<string>();
  for (const input of inputs) {
    ids.add(await enqueueReview({admin,localUnitId,actorId:permissions.authUser.id,input,
      candidateIds:findPersonMatches(reviewPerson(input),people).map(match => match.person.id)}));
  }
  revalidatePath('/people/reviews');
  return {queuedCount:ids.size,appliedCount:0,createdCount:0,updatedCount:0};
}
