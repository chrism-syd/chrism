import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decodeReview, type IntakeReview } from '@/lib/people-reviews/queue'
import { scanPeopleDuplicatesAction } from './actions'
export default async function PeopleIntakeQueue({admin,localUnitId,page=0,status='pending'}:{admin:SupabaseClient;localUnitId:string;page?:number;status?:'pending'|'resolved'}) {
  const offset=Math.max(0,Math.min(10000,page*50))
  const result=await admin.from('people_intake_reviews').select('*',{count:'exact'}).eq('local_unit_id',localUnitId)
    .eq('status',status).order('created_at',{ascending:status==='pending'}).range(offset,offset+49)
  if(result.error) return <section className="qv-card qv-error">Could not load incoming and duplicate reviews. Please try again.</section>
  const rows=(result.data??[]) as IntakeReview[]
  return <section className="qv-card">
    <div className="qv-directory-section-head"><div><h2 className="qv-section-title">{status==='pending'?'Incoming records and possible duplicates':'Incoming and duplicate review decisions'}</h2>
      <p className="qv-section-subtitle">{result.count??0} {status==='pending'?'waiting':'completed'}. Compare matches before creating or updating a person. A match is evidence for review, not proof that two records are the same person.</p></div>
      {status==='pending'?<form action={scanPeopleDuplicatesAction}><button className="qv-link-button qv-button-secondary">Check existing people for duplicates</button></form>:null}</div>
    {!rows.length?<p>No incoming or duplicate records are waiting.</p>:rows.map(row=>{
      const input=decodeReview(row)
      const name=input.kind==='existing'?(input.displayName??'Existing records: possible duplicate'):input.kind==='roster'?`${input.fieldValues.first_name??''} ${input.fieldValues.last_name??''}`:`${input.values.first_name} ${input.values.last_name}`
      return <div className="qv-list-row-card" key={row.id}><div className="qv-list-row-head"><div>
        <div className="qv-list-row-title">{name}</div><p>{input.kind==='roster'?`Roster row ${input.sourceRowNumber}`:input.kind==='manual'?'New-person entry':'Existing People comparison'} {status==='resolved'?`— ${row.decision?.replaceAll('_',' ')}`:''} · {new Date(row.created_at).toLocaleDateString('en-CA',{timeZone:'America/Toronto'})}</p>
      </div><Link className="qv-link-button qv-button-primary" href={`/people/reviews/imports/${row.id}`}>Compare records</Link></div></div>
    })}
    <div className="qv-directory-actions">{page>0?<Link href={`/people/reviews/imports?page=${page-1}&status=${status}`}>Previous reviews</Link>:null}
      {offset+rows.length<(result.count??0)?<Link href={`/people/reviews/imports?page=${page+1}&status=${status}`}>Next reviews</Link>:null}</div>
  </section>
}
