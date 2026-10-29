import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptOptionalValue, encryptReviewSnapshot } from '@/lib/security/pii'
import type { ImportFieldKey } from '@/lib/imports/supreme'
import type { MemberFormValues } from '@/app/members/form-state'
import { findDuplicatePairs, type MatchPerson } from './matching'

export type RosterReviewInput = {
  kind: 'roster'; sourceRowNumber: number; councilNumber: string | null;
  fieldValues: Record<ImportFieldKey, string | null>; sourceNotes?: string | null; home_phone?: string | null; other_phone?: string | null;
}
export type ReviewInput = RosterReviewInput | { kind: 'manual'; values: MemberFormValues } | { kind: 'existing'; personIds: string[]; displayName?: string }
export type IntakeReview = {
  id: string; local_unit_id: string; source_kind: ReviewInput['kind']; encrypted_input: string;
  status: 'pending' | 'resolved'; candidate_ids: string[]; created_at: string; decision: string | null;
}
export function decodeReview(review: IntakeReview): ReviewInput {
  return JSON.parse(decryptOptionalValue(review.encrypted_input) ?? '{}') as ReviewInput
}
export function reviewPerson(input: ReviewInput): MatchPerson {
  if (input.kind === 'existing') throw new Error('Existing reviews contain references, not an incoming person.')
  const v = input.kind === 'roster' ? input.fieldValues : input.values
  return { id: 'incoming', first_name: v.first_name ?? '', middle_name: v.middle_name, last_name: v.last_name ?? '',
    email: v.email, cell_phone: v.cell_phone, address_line_1: v.address_line_1, city: v.city, postal_code: v.postal_code,
    home_phone: input.kind === 'manual' ? input.values.home_phone : input.home_phone,
    other_phone: input.kind === 'manual' ? input.values.other_phone : input.other_phone,
    member_number: 'member_number' in v ? v.member_number : null, birth_date: 'birth_date' in v ? v.birth_date : null }
}
export function reviewFingerprint(input: ReviewInput) {
  if (input.kind === 'existing') return createHash('sha256').update('existing:'+input.personIds.slice().sort().join(':')).digest('hex')
  const raw = input.kind === 'roster' ? { ...input.fieldValues, source_notes:input.sourceNotes, home_phone: input.home_phone, other_phone: input.other_phone } : input.values
  // Idempotence is for the same submission, not merely the same identity.
  // Preserve meaningful edits (especially punctuation and case in notes).
  const normalized = Object.entries(raw).sort(([a],[b]) => a.localeCompare(b))
    .map(([key,value]) => [key,(value??'').replaceAll('\r\n','\n').trim()])
  return createHash('sha256').update(JSON.stringify([input.kind, normalized])).digest('hex')
}
export async function enqueueReview(args: {
  admin: SupabaseClient; localUnitId: string; actorId: string; input: ReviewInput; candidateIds: string[];
}) {
  const { admin, localUnitId, actorId, input, candidateIds } = args
  const key = reviewFingerprint(input)
  const { data, error } = await admin.from('people_intake_reviews').upsert({
    local_unit_id: localUnitId, source_kind: input.kind, dedupe_key: key,
    encrypted_input: encryptReviewSnapshot(JSON.stringify(input)), candidate_ids: candidateIds,
    created_by_auth_user_id: actorId,
  }, { onConflict: 'local_unit_id,dedupe_key', ignoreDuplicates: true }).select('id').maybeSingle()
  if (error) throw new Error(`Could not queue this record for review. ${error.message}`)
  if (data) return data.id as string
  const existing = await admin.from('people_intake_reviews').select('id').eq('local_unit_id',localUnitId).eq('dedupe_key',key).single()
  if (existing.error) throw new Error('Could not find the queued review.')
  return existing.data.id as string
}
export async function scanExistingDuplicates(args: { admin: SupabaseClient; localUnitId: string; actorId: string; people: MatchPerson[] }) {
  const pairs = findDuplicatePairs(args.people)
  // Existing scans are idempotent, including explicitly dismissed matches. Batch
  // reads/writes avoid one network round-trip per pair on each Reviews visit.
  for(let offset=0;offset<pairs.length;offset+=100) {
    const batch=pairs.slice(offset,offset+100).map(pair=>{
      const input: ReviewInput={kind:'existing',personIds:[pair.left.id,pair.right.id],displayName:`${pair.left.first_name} ${pair.left.last_name} / ${pair.right.first_name} ${pair.right.last_name}`}
      return {input,key:reviewFingerprint(input),ids:[pair.left.id,pair.right.id]}
    })
    const existing=await args.admin.from('people_intake_reviews').select('dedupe_key').eq('local_unit_id',args.localUnitId).in('dedupe_key',batch.map(row=>row.key))
    if(existing.error)throw new Error('Could not check existing duplicate reviews.')
    const known=new Set((existing.data??[]).map(row=>row.dedupe_key))
    const fresh=batch.filter(row=>!known.has(row.key)).map(row=>({local_unit_id:args.localUnitId,source_kind:'existing',dedupe_key:row.key,
      encrypted_input:encryptReviewSnapshot(JSON.stringify(row.input)),candidate_ids:row.ids,created_by_auth_user_id:args.actorId}))
    if(fresh.length) {
      const saved=await args.admin.from('people_intake_reviews').upsert(fresh,{onConflict:'local_unit_id,dedupe_key',ignoreDuplicates:true})
      if(saved.error)throw new Error('Could not queue existing duplicate candidates.')
    }
  }
  return pairs.length
}

// Fetch all waiting rows in bounded pages: PostgREST's default row cap must
// not hide a match in a large upload or an earlier waiting file.
export async function loadWaitingReviews(admin: SupabaseClient,localUnitId: string,excludeId: string) {
  const rows: IntakeReview[]=[]
  for(let offset=0;offset<10000;offset+=500) {
    const result=await admin.from('people_intake_reviews').select('*').eq('local_unit_id',localUnitId)
      .eq('status','pending').neq('id',excludeId).order('id').range(offset,offset+499)
    if(result.error)throw new Error('Could not compare waiting rows. Please try again.')
    const page=(result.data??[]) as IntakeReview[]
    rows.push(...page)
    if(page.length<500)return rows
  }
  throw new Error('There are more than 10,000 waiting records. Complete earlier reviews before comparing this row.')
}
