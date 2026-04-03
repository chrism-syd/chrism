import Link from 'next/link'
import { redirect } from 'next/navigation'
import AppHeader from '@/app/app-header'
import { getCurrentUserPermissions } from '@/lib/auth/permissions'

function pickOperationsLanding(permissions: Awaited<ReturnType<typeof getCurrentUserPermissions>>) {
  if (permissions.canAccessMemberData) return '/members'
  if (permissions.canManageEvents) return '/events'
  if (permissions.canManageCustomLists) return '/custom-lists'
  if (permissions.canAccessOrganizationSettings) return '/me/council'
  return '/spiritual'
}

export default async function HomePage() {
  const permissions = await getCurrentUserPermissions()

  if (!permissions.isSignedIn) {
    redirect('/login')
  }

  if (!permissions.hasStaffAccess || permissions.actingMode === 'member') {
    if (!permissions.personId) {
      redirect('/me')
    }
    redirect('/spiritual')
  }

  const cards = [
    permissions.canAccessMemberData
      ? {
          href: '/members',
          eyebrow: 'Members',
          title: 'Member directory',
          description: 'Open the roster, review profiles, and keep your organization records current.',
        }
      : null,
    permissions.canManageEvents
      ? {
          href: '/events',
          eyebrow: 'Events',
          title: 'Plan and manage events',
          description: 'Create events, invite councils, and manage volunteer or RSVP flows.',
        }
      : null,
    permissions.canManageCustomLists
      ? {
          href: '/custom-lists',
          eyebrow: 'Custom lists',
          title: 'Organize outreach lists',
          description: 'Build small working lists for follow-up, recruiting, or campaigns.',
        }
      : null,
    permissions.canAccessOrganizationSettings
      ? {
          href: '/me/council',
          eyebrow: 'Organization',
          title: 'Organization settings',
          description: 'Manage officers, admin access, and the organization identity shown in Chrism.',
        }
      : null,
  ].filter(Boolean) as Array<{
    href: string
    eyebrow: string
    title: string
    description: string
  }>

  if (cards.length === 0) {
    redirect(pickOperationsLanding(permissions))
  }

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <p className="qv-eyebrow">Operations</p>
          <h1 className="qv-title">Welcome back</h1>
          <p className="qv-subtitle">
            Choose the area you want to work in today.
          </p>
        </section>

        <section className="qv-grid" style={{ marginTop: 24 }}>
          {cards.map((card) => (
            <Link key={card.href} href={card.href} className="qv-card qv-card-link">
              <p className="qv-eyebrow">{card.eyebrow}</p>
              <h2 className="qv-section-title" style={{ marginTop: 4 }}>{card.title}</h2>
              <p className="qv-section-subtitle" style={{ marginTop: 12 }}>{card.description}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  )
}
