import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import ts from 'typescript'
import {renderToStaticMarkup} from 'react-dom/server'
import {randomUUID} from 'node:crypto'
const root=process.cwd(),out=path.join(root,'.next/people-intake-tests')
await mkdir(out,{recursive:true})
process.env.PII_ENCRYPTION_KEY='non-production-regression-key'
const files={
  normalization:'lib/imports/supreme-text-normalization.ts',matching:'lib/people-reviews/matching.ts',csv:'lib/imports/csv.ts',
  pii:'lib/security/pii.ts',queue:'lib/people-reviews/queue.ts',supreme:'lib/imports/supreme.ts',loader:'lib/imports/supreme-existing-people.ts',
  detail:'app/people/reviews/imports/[id]/page.tsx',panel:'app/people/reviews/imports/queue-panel.tsx',apply:'app/imports/supreme/actions.ts',memberActions:'app/members/actions.ts',reviewActions:'app/people/reviews/imports/actions.ts',rpc:'lib/imports/supreme-apply.ts',fields:'lib/people-reviews/fields.ts',
}
const urls=Object.fromEntries(Object.keys(files).map(key=>[key,pathToFileURL(path.join(out,key+'.mjs')).href]))
urls.context=pathToFileURL(path.join(out,'context.mjs')).href
urls.customLists=pathToFileURL(path.join(out,'custom-lists.mjs')).href
urls.header=pathToFileURL(path.join(out,'header.mjs')).href
urls.link=pathToFileURL(path.join(out,'link.mjs')).href
urls.navigation=pathToFileURL(path.join(out,'navigation.mjs')).href
urls.cache=pathToFileURL(path.join(out,'cache.mjs')).href
const aliases={
 '@/lib/imports/supreme-text-normalization':urls.normalization,'@/lib/people-reviews/matching':urls.matching,
 '@/lib/security/pii':urls.pii,'@/lib/people-reviews/queue':urls.queue,'@/lib/imports/supreme':urls.supreme,
 '@/lib/imports/supreme-existing-people':urls.loader,'@/lib/auth/acting-context':urls.context,'next/cache':urls.cache,
 '@/lib/members/directory-assignments':pathToFileURL(path.join(root,'lib/members/directory-assignments.ts')).href,
 '@/lib/custom-lists':urls.customLists,'@/app/app-header':urls.header,'next/link':urls.link,'../actions':urls.reviewActions,'./actions':urls.reviewActions,'./queue-panel':urls.panel,'./matching':urls.matching,'./queue':urls.queue,'@/lib/people-reviews/fields':urls.fields,'@/lib/imports/supreme-apply':urls.rpc,'next/navigation':urls.navigation,
 '@/lib/security/contact-validation':pathToFileURL(path.join(root,'lib/security/contact-validation.ts')).href,
}
for(const [key,file] of Object.entries(files)) {
  let code=ts.transpileModule(await readFile(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
  for(const [alias,url]of Object.entries(aliases))code=code.replaceAll(`'${alias}'`,`'${url}'`).replaceAll(`"${alias}"`,`"${url}"`)
  await writeFile(path.join(out,key+'.mjs'),code)
}
await writeFile(path.join(out,'context.mjs'),'export async function getCurrentActingCouncilContext(options){globalThis.__intakeState.contexts.push(options);return globalThis.__intakeState.context}')
await writeFile(path.join(out,'navigation.mjs'),'export function redirect(url){throw new Error("REDIRECT:"+url)} export function notFound(){throw new Error("NOT_FOUND")}')
await writeFile(path.join(out,'custom-lists.mjs'),'export async function resolveLegacyCouncilIdForLocalUnit(){return "council-7689"} export async function listValidDirectoryPersonIdsForLocalUnit(){return []}')
await writeFile(path.join(out,'header.mjs'),'export default function Header(){return null}')
await writeFile(path.join(out,'link.mjs'),'import {createElement} from "react";export default function Link({children,...props}){return createElement("a",props,children)}')
await writeFile(path.join(out,'cache.mjs'),'export function revalidatePath(path){globalThis.__intakeState.invalidated.push(path)}')
const unit='unit-7689',org='organization-7689'
const people=[
 {id:'mark-old',first_name:'Mark',middle_name:'P',last_name:'Angelini',primary_relationship_code:'member',home_phone:'416-555-0100'},
 {id:'mark-numbered',updated_at:'2026-10-29T20:00:00Z',first_name:'Mark',middle_name:'P',last_name:'Angelini',primary_relationship_code:'member',organization_memberships:[]},
 {id:'ended',first_name:'Hidden',last_name:'Person',primary_relationship_code:'member'},
 {id:'outside',first_name:'Outside',last_name:'Person',primary_relationship_code:'member',organization_memberships:[{organization_id:'other-org',membership_number:'999'}]},
]
const tables={people,local_unit_people:people.map(p=>({person_id:p.id,local_unit_id:p.id==='outside'?'another-unit':unit,ended_at:p.id==='ended'?'2026-01-01':null})),member_records:[
 {legacy_people_id:'mark-numbered',member_number:'04148022',local_unit_id:unit,archived_at:null},
 {legacy_people_id:'ended',member_number:'123',local_unit_id:unit,archived_at:null},
],people_intake_reviews:[]}
let writeCount=0
class Query {
 constructor(table){this.table=table;this.filters=[];this.mode='list'}
 select(){return this} eq(k,v){this.filters.push(row=>row[k]===v);return this} is(k,v){this.filters.push(row=>(row[k]??null)===v);return this}
 neq(k,v){this.filters.push(row=>row[k]!==v);return this} limit(){return this} range(){return this}
 in(k,v){this.filters.push(row=>v.includes(row[k]));return this} order(){return this}
 maybeSingle(){this.mode='single';return this} single(){this.mode='single';return this}
 upsert(row){assert.equal(this.table,'people_intake_reviews','upload can only stage reviews');this.pending=row;return this}
 then(resolve,reject){try{return Promise.resolve(this.execute()).then(resolve,reject)}catch(error){return Promise.reject(error).then(resolve,reject)}}
 execute(){
  let data=tables[this.table]
  assert.ok(data,`unexpected table ${this.table}`)
  if(Array.isArray(this.pending))return {data:this.pending.map(row=>new Query(this.table).upsert(row).execute().data),error:null}
  if(this.pending){
   const duplicate=data.find(row=>row.local_unit_id===this.pending.local_unit_id&&row.dedupe_key===this.pending.dedupe_key)
   if(duplicate)return {data:null,error:null}
   const row={id:randomUUID(),...this.pending,status:'pending'};data.push(row);writeCount++;return {data:row,error:null}
  }
  data=data.filter(row=>this.filters.every(filter=>filter(row)))
  return {data:this.mode==='single'?data[0]??null:data,error:null}
 }
}
const calls=[]
const admin={from:table=>new Query(table),rpc(name,args){calls.push({name,args});return {data:{person_id:args.p_target_person_id},error:null}}}
globalThis.__intakeState={contexts:[],invalidated:[],context:{admin,permissions:{authUser:{id:'actor'}},localUnitId:unit,council:{organization_id:org,council_number:'7689'}}}
const [{applySupremeImportAction},supreme,queue,pii,{loadSupremeImportExistingPeopleForLocalUnit},matching,{parseCsv}]=await Promise.all([
 import(urls.apply),import(urls.supreme),import(urls.queue),import(urls.pii),import(urls.loader),import(urls.matching),import(urls.csv),
])
const candidates=await loadSupremeImportExistingPeopleForLocalUnit({admin,localUnitId:unit,organizationId:org})
assert.deepEqual(candidates.map(p=>p.id),['mark-old','mark-numbered'])
assert.equal(candidates[1].member_number,'04148022','legacy membership number remains matching evidence')
const fieldValues=Object.fromEntries(supreme.IMPORT_FIELD_DEFINITIONS.map(field=>[field.key,null]))
const row=(number,extra={})=>({rowId:String(number),sourceRowNumber:number,councilNumber:'7689',existingPersonId:'outside',importMode:'create_new',
 fieldValues:{...fieldValues,first_name:'Mark',last_name:'Angelini',member_number:'4148022'},homePhone:'4165550100',sourceNotes:'Member\nNumber: 4148022\nKeep THIS Case',...extra})
const response=await applySupremeImportAction({rows:[row(2),row(3,{fieldValues:{...fieldValues,first_name:'Mark',last_name:'Angelini',member_number:null}})]})
assert.equal(response.queuedCount,2)
assert.equal(response.appliedCount,0)
assert.equal(calls.length,0,'upload must never mutate People via RPC')
assert.equal(writeCount,2)
assert.deepEqual(tables.people_intake_reviews[0].candidate_ids,['mark-old','mark-numbered'])
assert.ok(tables.people_intake_reviews[0].encrypted_input.startsWith('enc:'))
assert.ok(!tables.people_intake_reviews[0].encrypted_input.includes('Angelini'))
assert.equal(queue.decodeReview(tables.people_intake_reviews[0]).sourceNotes,'Member\nNumber: 4148022\nKeep THIS Case')
await applySupremeImportAction({rows:[row(7),row(8,{fieldValues:{...fieldValues,first_name:'Mark',last_name:'Angelini',member_number:null}})]})
assert.equal(writeCount,2,'repeat upload must reuse reviews even when row numbers change')
await assert.rejects(()=>applySupremeImportAction({rows:[row(10),row(11,{councilNumber:'9999'})]}),/council does not match/)
assert.equal(writeCount,2,'validate whole upload before staging any rows')
await assert.rejects(()=>applySupremeImportAction({rows:[row(10,{homePhone:123})]}),/invalid/)
const csv='\uFEFFFirst Name,Last Name,Notes,Phone 1 - Value\r\nMark,Angelini,"First line\nMember Number: 4148022\nHe said ""hello""",4165550100\r\nOther,Person,,\r\n'
const parsed=parseCsv(csv)
assert.equal(parsed.length,3)
assert.equal(parsed[1][2],'First line\nMember Number: 4148022\nHe said "hello"')
const headers=supreme.extractSpreadsheetColumns(parsed)
const mapping=supreme.createInitialColumnMapping(headers.columns)
assert.deepEqual(supreme.getMissingRequiredMappings(mapping),[],'member number and council number are optional')
const mapped=supreme.mapSpreadsheetRowsToSupremeRows(parsed,mapping)
assert.equal(mapped.length,2,'missing member numbers must not silently drop people')
assert.equal(mapped[0].sourceNotes,parsed[1][2])
assert.throws(()=>parseCsv('first,last\n"unfinished'),/unclosed/)
assert.equal(matching.findDuplicatePairs([queue.reviewPerson(queue.decodeReview(tables.people_intake_reviews[0])),{...queue.reviewPerson(queue.decodeReview(tables.people_intake_reviews[1])),id:'second-row'}]).length,1)
const arbitrary='{"first_name":"McDONALD","notes":"MiXeD case\\nNew line"}'
assert.equal(pii.decryptOptionalValue(pii.encryptReviewSnapshot(arbitrary)),arbitrary)
console.log('People intake flow: scoped loading, member-number fallback, all-candidate matching, encrypted staging, whole-file validation, repeat-upload idempotence, multiline CSV/notes, blank member numbers, batch matches and no direct People writes passed.')

const {resolvePeopleIntakeAction}=await import(urls.reviewActions)
const intake=tables.people_intake_reviews[0]
const form=new FormData()
form.set('target_version','2026-10-29T20:00:00Z');form.set('candidate_ids','mark-numbered,mark-old');form.set('review_id',intake.id);form.set('target_id','mark-numbered');form.set('decision','update');form.append('use_incoming','home_phone');form.set('save_source_notes','yes')
await assert.rejects(()=>resolvePeopleIntakeAction(form),/REDIRECT:/)
assert.equal(calls.length,1)
assert.equal(calls[0].name,'resolve_people_intake_review')
assert.equal(calls[0].args.p_local_unit_id,unit)
assert.equal(calls[0].args.p_person_patch.primary_relationship_code,undefined,'review must not implicitly change a matched category')
assert.equal(pii.decryptOptionalValue(calls[0].args.p_person_patch.home_phone),'4165550100')
assert.equal(calls[0].args.p_rpc_args.p_member_number,'04148022','unchecked fields keep the current padded member number')
assert.equal(calls[0].args.p_rpc_args._source_note,'Member\nNumber: 4148022\nKeep THIS Case')
const separate=new FormData();separate.set('review_id',intake.id);separate.set('decision','create')
await assert.rejects(()=>resolvePeopleIntakeAction(separate),/Confirm/)
assert.equal(calls.length,1)
const stale=new FormData();stale.set('review_id',intake.id);stale.set('decision','update');stale.set('target_id','outside')
await assert.rejects(()=>resolvePeopleIntakeAction(stale),/current matching person/)
assert.equal(calls.length,1)
console.log('Review decisions: authenticated scope, selected-field protection, existing-value defaults, source notes, category preservation, explicit separate-person confirmation and stale/out-of-scope targets passed.')

const {createMemberAction}=await import(urls.memberActions)
const duplicate=new FormData();duplicate.set('first_name','Mark');duplicate.set('last_name','Angelini');duplicate.set('email','mark-entry@example.invalid');duplicate.set('primary_relationship_code','volunteer_only')
await assert.rejects(()=>createMemberAction(null,duplicate),/REDIRECT:\/people\/reviews\/imports/)
assert.equal(calls.length,1,'manual duplicate must queue before creating any person')
const clean=new FormData();clean.set('first_name','Unmatched');clean.set('last_name','Entry');clean.set('email','clean@example.invalid');clean.set('primary_relationship_code','prospect')
await assert.rejects(()=>createMemberAction(null,clean),/REDIRECT:/)
assert.equal(calls.length,2,'a clean manual entry uses the guarded transaction')
assert.equal(calls[1].args.p_person_patch.primary_relationship_code,'prospect')
console.log('New-person entry: duplicate diversion and guarded creation with submitted category passed.')

const {default:DetailPage}=await import(urls.detail)
const detail=await DetailPage({params:Promise.resolve({id:intake.id}),searchParams:Promise.resolve({candidate:'mark-numbered'})})
const html=renderToStaticMarkup(detail)
assert.ok(html.includes('Matching people (2)'),'both Mark profiles must be visible in the review')
assert.ok(html.includes('Current and incoming field comparison'))
assert.ok(html.includes('Original notes from the file'))
assert.ok(html.includes('Matching waiting rows'),'within-upload duplicates must be shown')
assert.ok(html.includes('Save selected updates to this person'))
assert.ok(html.includes('Create this separate person'))
assert.ok(html.includes('candidate_ids'),'stale candidate protection must be submitted with decisions')
const {default:QueuePanel}=await import(urls.panel)
const queueHtml=renderToStaticMarkup(await QueuePanel({admin,localUnitId:unit}))
assert.ok(queueHtml.includes('Compare records'))
console.log('Review UI rendering: both Mark records, highlighted field comparison, multiline source notes, waiting-row matches, explicit decisions and candidate freshness fields passed.')

assert.ok(html.includes('<mark>'),'matching field values must be visibly highlighted')
const beforeScan=writeCount
await queue.scanExistingDuplicates({admin,localUnitId:unit,actorId:'actor',people:candidates})
assert.equal(writeCount,beforeScan+1)
const existingPair=tables.people_intake_reviews.find(row=>row.source_kind==='existing')
assert.ok(queue.decodeReview(existingPair).displayName.includes('Mark Angelini'))
existingPair.status='resolved';existingPair.decision='keep_separate'
await queue.scanExistingDuplicates({admin,localUnitId:unit,actorId:'actor',people:candidates})
assert.equal(writeCount,beforeScan+1,'dismissed matches must not be recreated on each Reviews visit')
const staleVersion=new FormData();staleVersion.set('review_id',intake.id);staleVersion.set('decision','update');staleVersion.set('target_id','mark-numbered');staleVersion.set('candidate_ids','mark-numbered,mark-old');staleVersion.set('target_version','2000-01-01')
await assert.rejects(()=>resolvePeopleIntakeAction(staleVersion),/This%20person%20changed/)
const beforeRace=calls.length
tables.people.push({id:'new-match',first_name:'Mark',last_name:'Angelini',primary_relationship_code:'member'})
tables.local_unit_people.push({person_id:'new-match',local_unit_id:unit,ended_at:null})
await assert.rejects(()=>resolvePeopleIntakeAction(form),/Matching%20people%20changed/)
assert.equal(calls.length,beforeRace)
tables.people.pop();tables.local_unit_people.pop()
console.log('Automatic existing scan: encrypted candidate pairs, dismissed-pair idempotence, highlighted values and concurrent/stale comparison protections passed.')
