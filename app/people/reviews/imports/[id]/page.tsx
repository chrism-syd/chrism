import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { loadSupremeImportExistingPeopleForLocalUnit } from '@/lib/imports/supreme-existing-people'
import { decodeReview,reviewPerson,loadWaitingReviews,type IntakeReview } from '@/lib/people-reviews/queue'
import { findPersonMatches,matchingFields,matchLabels,normalizeMatchText,normalizeMatchNumber,normalizeMatchPhone } from '@/lib/people-reviews/matching'
import { currentValues,incomingValues,reviewFields,peopleFieldKeys } from '@/lib/people-reviews/fields'
import { resolvePeopleIntakeAction } from '../actions'
const fieldKey=(key:string,value:string|null)=>key==='member_number'?normalizeMatchNumber(value):key.includes('phone')?normalizeMatchPhone(value):key==='email'?(value??'').trim().toLowerCase():normalizeMatchText(value)
export default async function IntakeReviewPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{candidate?:string;error?:string}>}) {
  const {id}=await params
  if(!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const query=await searchParams
  const {admin,localUnitId,council}=await getCurrentActingCouncilContext({requireAdmin:true,redirectTo:'/people/reviews',areaCode:'members',minimumAccessLevel:'edit_manage'})
  if(!localUnitId) notFound()
  const [result,people,others]=await Promise.all([
    admin.from('people_intake_reviews').select('*').eq('local_unit_id',localUnitId).eq('id',id).maybeSingle(),
    loadSupremeImportExistingPeopleForLocalUnit({admin,localUnitId,organizationId:council.organization_id}),
    loadWaitingReviews(admin,localUnitId,id),
  ])
  if(result.error) throw new Error('Could not load this review.')
  if(!result.data) notFound()
  const review=result.data as IntakeReview,input=decodeReview(review)
  const matches=input.kind==='existing'?people.filter(person=>input.personIds.includes(person.id)).map(person=>({person,fields:matchingFields(person,people.find(other=>input.personIds.includes(other.id)&&other.id!==person.id)??person)})):findPersonMatches(reviewPerson(input),people)
  const selected=matches.find(match=>match.person.id===query.candidate)?.person??(matches.length===1?matches[0].person:null)
  const incoming=incomingValues(input),current=currentValues(selected)
  const siblings=input.kind==='existing'?[]:others.flatMap(row=>{
    const other=decodeReview(row)
    if(other.kind==='existing')return []
    const fields=matchingFields({...reviewPerson(input),id}, {...reviewPerson(other),id:row.id})
    return fields.length?[{id:row.id,person:reviewPerson(other),fields}]:[]
  })
  return <main className="qv-page"><div className="qv-shell"><AppHeader/>
    <section className="qv-card"><Link href="/people/reviews">Back to People Reviews</Link><h1>{input.kind==='existing'?'Compare existing records':`${incoming.first_name??''} ${incoming.last_name??''}`}</h1>
      <p>Review within {council.name}. Identical names or shared household details need a decision; nothing is automatically merged.</p>
      {query.error?<p role="alert" className="qv-error">{query.error}</p>:null}
      {review.status==='resolved'?<p role="status">This review is complete: {review.decision?.replaceAll('_',' ')}. <Link href="/people">Open People</Link></p>:null}
    </section>
    {input.kind==='roster'&&input.sourceNotes?<section className="qv-card"><h2>Original notes from the file</h2><p>Check these notes for membership details and remarks before choosing a category or changing a person.</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{input.sourceNotes}</pre></section>:null}
    {input.kind!=='existing'&&review.status==='resolved'?<section className="qv-card"><details><summary>Original submitted fields</summary><dl>{reviewFields(input).map(field=><div key={field.key}><dt>{field.label}</dt><dd>{incoming[field.key]||'Not set'}</dd></div>)}</dl></details></section>:null}
    <section className="qv-card"><h2>Matching people ({matches.length})</h2>
      {!matches.length?<p>No current matching person was found in this organization.</p>:matches.map(match=><div className="qv-list-row-card" key={match.person.id}>
        <h3>{match.person.first_name} {match.person.middle_name} {match.person.last_name}</h3>
        <p>Category: {match.person.primary_relationship_code.replaceAll('_',' ')} · Member number: {match.person.member_number??'Not set'}</p>
        <p>Matching evidence: {match.fields.map(field=>matchLabels[field]).join(', ')}</p>
        <p>Email: {match.person.email??'Not set'} · Cell: {match.person.cell_phone??'Not set'} · Home: {match.person.home_phone??'Not set'}</p>
        <div className="qv-directory-actions"><Link href={`/people/${match.person.id}`}>Open profile</Link>{input.kind!=='existing'?<Link href={`/people/reviews/imports/${id}?candidate=${match.person.id}`}>Compare with incoming record</Link>:null}</div>
        {input.kind==='existing'&&review.status==='pending'?<form action={resolvePeopleIntakeAction}>
          <input type="hidden" name="review_id" value={id}/><input type="hidden" name="target_id" value={match.person.id}/>
          <p>Archiving keeps this copy and its history in Archived people. It does not transfer its history into another profile.</p>
          <label><input type="checkbox" name="confirm_archive" value="yes" required/> I have checked this copy and want to archive it.</label><br/>
          <button className="qv-link-button qv-button-secondary" name="decision" value="archive_existing">Archive this copy</button></form>:null}
      </div>)}
    </section>
    {siblings.length?<section className="qv-card"><h2>Matching waiting rows ({siblings.length})</h2><p>These records have not been created. Review one first, then reopen the others to compare against the saved person.</p>
      {siblings.map(row=><p key={row.id}><Link href={`/people/reviews/imports/${row.id}`}>{row.person.first_name} {row.person.last_name}</Link> — {row.fields.map(field=>matchLabels[field]).join(', ')}</p>)}</section>:null}
    {input.kind!=='existing'&&review.status==='pending'?<>
      {selected?<section className="qv-card"><h2>Update {selected.first_name} {selected.last_name}</h2>
        <p>The existing category ({selected.primary_relationship_code.replaceAll('_',' ')}) will be preserved. Checked fields use the incoming value; unchecked fields keep the current value. Empty incoming fields never erase existing information.</p>
        {selected.primary_relationship_code!=='member'&&input.kind==='roster'?<p>Membership-only details will not be applied to a prospect or volunteer. Change their category separately only if membership is confirmed.</p>:null}
        <form action={resolvePeopleIntakeAction}><input type="hidden" name="review_id" value={id}/><input type="hidden" name="target_id" value={selected.id}/><input type="hidden" name="target_version" value={selected.updated_at??''}/><input type="hidden" name="candidate_ids" value={matches.map(match=>match.person.id).sort().join(',')}/>
          <div style={{overflowX:'auto'}}><table><caption>Current and incoming field comparison</caption><thead><tr><th scope="col">Field</th><th scope="col">Current</th><th scope="col">Incoming</th><th scope="col">Use incoming</th></tr></thead><tbody>
          {reviewFields(input).filter(field=>selected.primary_relationship_code==='member'||peopleFieldKeys.includes(field.key)).map(field=><tr key={field.key}><th scope="row">{field.label}</th><td>{current[field.key]||'Not set'}</td><td>{incoming[field.key]&&fieldKey(field.key,incoming[field.key])===fieldKey(field.key,current[field.key])?<mark>{incoming[field.key]} — matches</mark>:incoming[field.key]||'Not set'}</td><td><input aria-label={`Use incoming ${field.label}`} type="checkbox" name="use_incoming" value={field.key} disabled={!incoming[field.key]} defaultChecked={Boolean(incoming[field.key]&&!current[field.key])}/></td></tr>)}
          </tbody></table></div>{input.kind==='roster'&&input.sourceNotes?<p><label><input type="checkbox" name="save_source_notes" value="yes" defaultChecked/> Save the original source notes as a historical person note</label></p>:null}<button className="qv-link-button qv-button-primary" name="decision" value="update">Save selected updates to this person</button>
        </form></section>:null}
      <section className="qv-card"><h2>Create a separate person</h2><p>Use this only when the incoming record represents someone else. Choose the category for an uploaded person. Manual entries keep the category you originally submitted; existing people keep their current category.</p>
        <details><summary>View all incoming fields</summary><dl>{reviewFields(input).map(field=><div key={field.key}><dt>{field.label}</dt><dd>{incoming[field.key]||'Not set'}</dd></div>)}</dl></details>
        <form action={resolvePeopleIntakeAction}><input type="hidden" name="review_id" value={id}/><input type="hidden" name="candidate_ids" value={matches.map(match=>match.person.id).sort().join(',')}/>
          {reviewFields(input).filter(field=>field.key!=='member_number'&&incoming[field.key]).map(field=><input key={field.key} type="hidden" name="use_incoming" value={field.key}/>)}
          {input.kind==='roster'&&incoming.member_number?<p><label><input type="checkbox" name="use_incoming" value="member_number" defaultChecked/> Use incoming member number {incoming.member_number}</label> (A number already assigned to another person cannot be reused.)</p>:null}
          {input.kind==='roster'?<p><label>New person’s category <select name="create_relationship" required defaultValue=""><option value="" disabled>Choose a category</option><option value="member">Member</option><option value="volunteer_only">Volunteer</option><option value="prospect">Prospect</option></select></label> Membership-only fields apply only when Member is chosen.</p>:<p>New person’s category: {input.values.primary_relationship_code.replaceAll('_',' ')}</p>}
          {input.kind==='roster'&&input.sourceNotes?<p><label><input type="checkbox" name="save_source_notes" value="yes" defaultChecked/> Save the original source notes as a historical person note</label></p>:null}
          <p><label><input type="checkbox" name="confirm_separate" value="yes" required/> I confirm this is a separate new person, after reviewing the possible matches.</label></p>
          <button className="qv-link-button qv-button-secondary" name="decision" value="create">Create this separate person</button>
        </form></section>
    </>:null}
    {review.status==='pending'?<section className="qv-card"><form action={resolvePeopleIntakeAction}><input type="hidden" name="review_id" value={id}/><button className="qv-link-button qv-button-secondary" name="decision" value={input.kind==='existing'?'keep_separate':'skip'}>{input.kind==='existing'?'Keep both records — dismiss this match':'Skip this incoming record'}</button></form></section>:null}
  </div></main>
}
