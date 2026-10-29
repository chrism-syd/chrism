import Link from 'next/link'
import AppHeader from '@/app/app-header'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import PeopleIntakeQueue from './queue-panel'
export default async function IntakeReviews({searchParams}:{searchParams:Promise<{page?:string;status?:string}>}) {
  const {admin,localUnitId}=await getCurrentActingCouncilContext({requireAdmin:true,redirectTo:'/people/reviews',areaCode:'members',minimumAccessLevel:'edit_manage'})
  if(!localUnitId) throw new Error('Choose a local organization.')
  const params=await searchParams
  const page=/^\d+$/.test(params.page??'')?Number(params.page):0
  return <main className="qv-page"><div className="qv-shell"><AppHeader/><section className="qv-card"><h1>Incoming records and duplicates</h1><Link href="/people/reviews">Back to People Reviews</Link></section><PeopleIntakeQueue admin={admin} localUnitId={localUnitId} page={page} status={params.status==='resolved'?'resolved':'pending'}/></div></main>
}
