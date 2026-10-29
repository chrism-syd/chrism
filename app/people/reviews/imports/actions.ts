'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { loadSupremeImportExistingPeopleForLocalUnit } from '@/lib/imports/supreme-existing-people'
import { buildRpcArguments } from '@/lib/imports/supreme-apply'
import { protectPeoplePayload } from '@/lib/security/pii'
import { isValidEmailAddress } from '@/lib/security/contact-validation'
import { decodeReview, scanExistingDuplicates, reviewPerson, type IntakeReview } from '@/lib/people-reviews/queue'
import { findPersonMatches } from '@/lib/people-reviews/matching'
import { currentValues, incomingValues, peopleFieldKeys, reviewFields } from '@/lib/people-reviews/fields'
import type { ImportFieldKey } from '@/lib/imports/supreme'

async function context() {
  const ctx = await getCurrentActingCouncilContext({requireAdmin:true,redirectTo:'/people/reviews',areaCode:'members',minimumAccessLevel:'edit_manage'})
  if (!ctx.localUnitId || !ctx.permissions.authUser) throw new Error('An active organization and signed-in administrator are required.')
  return {...ctx,localUnitId:ctx.localUnitId,actorId:ctx.permissions.authUser.id,db:ctx.admin as unknown as SupabaseClient}
}
export async function scanPeopleDuplicatesAction() {
  const ctx = await context()
  const people = await loadSupremeImportExistingPeopleForLocalUnit({admin:ctx.admin,localUnitId:ctx.localUnitId,organizationId:ctx.council.organization_id})
  await scanExistingDuplicates({admin:ctx.db,localUnitId:ctx.localUnitId,actorId:ctx.actorId,people})
  revalidatePath('/people/reviews')
  redirect('/people/reviews')
}
export async function resolvePeopleIntakeAction(form: FormData) {
  const ctx = await context()
  const reviewId = String(form.get('review_id') ?? '')
  const targetId = String(form.get('target_id') ?? '') || null
  const decision = String(form.get('decision') ?? '')
  const result = await ctx.db.from('people_intake_reviews').select('*').eq('id',reviewId).eq('local_unit_id',ctx.localUnitId).maybeSingle()
  if (result.error || !result.data) throw new Error('Review not found in the active organization.')
  const review = result.data as IntakeReview
  if (review.status !== 'pending') redirect(`/people/reviews/imports/${reviewId}`)
  const input = decodeReview(review)
  const people = await loadSupremeImportExistingPeopleForLocalUnit({admin:ctx.admin,localUnitId:ctx.localUnitId,organizationId:ctx.council.organization_id})
  const target = people.find(person => person.id === targetId) ?? null
  const candidates = input.kind === 'existing' ? people.filter(person => input.personIds.includes(person.id)) : findPersonMatches(reviewPerson(input),people).map(match=>match.person)
  if ((decision === 'update' || decision === 'archive_existing') && (!target || !candidates.some(person=>person.id===targetId))) throw new Error('Choose a current matching person from this organization.')
  if (decision === 'archive_existing' && form.get('confirm_archive') !== 'yes') throw new Error('Confirm which copy to archive.');
  if (decision === 'create' && form.get('confirm_separate') !== 'yes') throw new Error('Confirm that this is a separate new person.')
  if ((decision==='create'||decision==='update') && String(form.get('candidate_ids')??'')!==candidates.map(person=>person.id).sort().join(',')) {
    redirect(`/people/reviews/imports/${reviewId}?error=${encodeURIComponent('Matching people changed. Compare the current candidates before making a decision.')}`)
  }
  if (decision==='update' && target?.updated_at && form.get('target_version')!==target.updated_at) {
    redirect(`/people/reviews/imports/${reviewId}?candidate=${targetId}&error=${encodeURIComponent('This person changed since the comparison was opened. Review the current fields before saving.')}`)
  }
  const incoming = incomingValues(input)
  const current = currentValues(target)
  const selected = new Set(form.getAll('use_incoming').map(String))
  const allowed = reviewFields(input).map(field=>field.key)
  const values = Object.fromEntries(allowed.map(key=>[key,selected.has(key) && incoming[key]?.trim() ? incoming[key].trim() : decision==='create' ? null : current[key]??null]))
  if (decision==='create' || decision==='update') {
    if (!values.first_name || !values.last_name) throw new Error('First name and last name are required.')
    if (values.email && !isValidEmailAddress(values.email)) throw new Error('The incoming email address is invalid. Keep the existing email or correct the source.')
    if (input.kind==='manual' && decision==='create' && ![values.email,values.cell_phone,values.home_phone,values.other_phone].some(Boolean)) throw new Error('A new person needs at least one contact method.')
  }
  const personPatch: Record<string,unknown> = Object.fromEntries(peopleFieldKeys.filter(key=>key in values && values[key]!=null).map(key=>[key,values[key]]))
  if (input.kind!=='existing' && decision==='create') {
    const relation = input.kind==='manual' ? input.values.primary_relationship_code : String(form.get('create_relationship')??'');
    if (!['member','prospect','volunteer_only'].includes(relation)) throw new Error('Choose the new person’s category.');
    Object.assign(personPatch,{primary_relationship_code:relation,is_provisional_member:relation==='member',
      created_source_code:input.kind==='roster'?'supreme_import':relation==='member'?'admin_manual_member':relation==='prospect'?'scoped_manual_prospect':'scoped_manual_volunteer',
      prospect_status_code:relation==='prospect'?'new':null,volunteer_context_code:relation==='volunteer_only'?'unknown':null})
  }
  const rpcArgs = input.kind==='roster' ? buildRpcArguments({row:{rowId:reviewId,sourceRowNumber:input.sourceRowNumber,councilNumber:input.councilNumber,
    existingPersonId:targetId,importMode:decision==='update'?'update_existing':'create_new',fieldValues:values as Record<ImportFieldKey,string|null>},
    localUnitId:ctx.localUnitId,organizationId:ctx.council.organization_id!,authUserId:ctx.actorId}) : {}
  const applied = await ctx.db.rpc('resolve_people_intake_review',{p_review_id:reviewId,p_local_unit_id:ctx.localUnitId,p_actor_user_id:ctx.actorId,
    p_decision:decision,p_target_person_id:targetId,p_rpc_args:{...rpcArgs,_expected_candidate_ids:candidates.map(person=>person.id),_expected_updated_at:target?.updated_at??null,_selected_fields:[...selected].filter(key=>allowed.includes(key)),_source_note:input.kind==='roster'&&form.get('save_source_notes')==='yes'?input.sourceNotes??null:null},p_person_patch:protectPeoplePayload(personPatch)})
  if (applied.error) redirect(`/people/reviews/imports/${reviewId}?error=${encodeURIComponent(applied.error.message)}`)
  for (const path of ['/people','/people/archive','/people/reviews','/imports/supreme',`/people/reviews/imports/${reviewId}`]) revalidatePath(path)
  redirect(`/people/reviews/imports/${reviewId}`)
}
