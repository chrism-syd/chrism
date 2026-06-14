import WelcomePage from '../welcome-page'

type AdminWelcomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdminWelcomePage({ searchParams }: AdminWelcomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const smokeTestLocalUnitId = typeof resolvedSearchParams.localUnitId === 'string'
    ? resolvedSearchParams.localUnitId
    : null

  return <WelcomePage variant="admin" smokeTestLocalUnitId={smokeTestLocalUnitId} />
}
