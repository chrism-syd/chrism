import Link from 'next/link'
import { notFound } from 'next/navigation'
import AppHeader from '@/app/app-header'
import ClearFlashMessageCookie from '@/app/components/clear-flash-message-cookie'
import MemberOfficerServiceSection from '@/app/members/member-officer-service-section'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { listValidDirectoryPersonIdsForLocalUnit } from '@/lib/custom-lists'
import { consumeFlashMessage } from '@/lib/flash-messages'
import { decryptPeopleRecord } from '@/lib/security/pii'
import type { OfficerTermRow } from '@/lib/members/officer-roles'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type PersonRow = {
  id: string
  first_name: string
  last_name: string
}

export default async function MemberOfficerTermsPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const routePath = `/people/${id}/officers`
  const queryErrorMessage = typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : null
  const queryNoticeMessage = typeof resolvedSearchParams.notice === 'string' ? resolvedSearchParams.notice : null
  const flashMessage = await consumeFlashMessage(routePath)
  const errorMessage = flashMessage?.kind === 'error' ? flashMessage.message : queryErrorMessage
  const noticeMessage = flashMessage?.kind === 'notice' ? flashMessage.message : queryNoticeMessage
  const shouldClearFlashMessage = Boolean(flashMessage)

  const { admin: supabase, localUnitId } = await getCurrentActingCouncilContext({
    requireAdmin: true,
    redirectTo: '/people',
    areaCode: 'members',
    minimumAccessLevel: 'edit_manage',
  })

  if (!localUnitId) {
    notFound()
  }

  const validLocalUnitPersonIds = await listValidDirectoryPersonIdsForLocalUnit({
    admin: supabase,
    localUnitId,
    personIds: [id],
  }).catch((): string[] => [])

  if (!validLocalUnitPersonIds.includes(id)) {
    notFound()
  }

  const { data: personData, error: personError } = await supabase
    .from('people')
    .select('id, first_name, last_name')
    .eq('id', id)
    .is('archived_at', null)
    .maybeSingle<PersonRow>()

  if (personError) {
    throw new Error(`Could not load person officer history. ${personError.message}`)
  }

  if (!personData) {
    notFound()
  }

  const person = decryptPeopleRecord(personData)

  const { data: officerTerms, error: officerTermsError } = await supabase
    .from('person_officer_terms')
    .select('id, office_scope_code, office_code, office_label, office_rank, service_start_year, service_end_year, manual_end_effective_date, notes')
    .eq('local_unit_id', localUnitId)
    .eq('person_id', person.id)
    .returns<OfficerTermRow[]>()

  if (officerTermsError) {
    throw new Error(`Could not load officer history. ${officerTermsError.message}`)
  }

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />
        {shouldClearFlashMessage ? <ClearFlashMessageCookie /> : null}

        <section className="qv-hero-card">
          <div className="qv-hero-top">
            <div>
              <p className="qv-eyebrow">Member directory</p>
              <h1 className="qv-title">Officer history</h1>
              <p className="qv-subtitle">
                Add role service years for {person.first_name} {person.last_name}.
              </p>
            </div>
            <div className="qv-top-actions">
              <Link href={`/people/${person.id}`} className="qv-link-button qv-button-secondary">
                Back to member
              </Link>
            </div>
          </div>
        </section>

        <MemberOfficerServiceSection
          person={person}
          terms={officerTerms ?? []}
          returnTo={routePath}
          noticeMessage={noticeMessage}
          errorMessage={errorMessage}
        />
      </div>
    </main>
  )
}
