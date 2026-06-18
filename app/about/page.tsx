import Image from 'next/image'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

function getRequestHost(value: string | null) {
  return (value ?? '').split(':')[0]?.trim().toLowerCase() ?? ''
}

function isMarketingHost(host: string) {
  return host === 'chrismworks.com' || host === 'www.chrismworks.com' || host === 'chrismworks.ca' || host === 'www.chrismworks.ca'
}

export default async function AboutPage() {
  const headerStore = await headers()
  const host = getRequestHost(headerStore.get('x-forwarded-host') ?? headerStore.get('host'))

  if (isMarketingHost(host)) {
    notFound()
  }

  return (
    <main className="qv-page" style={{ color: 'var(--text-primary)', minHeight: '100vh' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 18,
          padding: '14px clamp(20px, 6vw, 80px)',
          background: 'rgba(250, 246, 242, 0.82)',
          borderBottom: '1px solid var(--divider)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center' }} aria-label="Chrism app home">
          <Image src="/Chrism_horiz.svg" alt="Chrism" width={150} height={50} priority />
        </Link>
        <nav style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', fontSize: 14, fontWeight: 800 }}>
          <a href="#what" style={{ color: 'var(--text-primary)' }}>What it does</a>
          <a href="#pricing" style={{ color: 'var(--text-primary)' }}>Pricing</a>
          <Link href="/login" className="qv-link-button qv-button-secondary">Sign in</Link>
        </nav>
      </header>

      <section style={{ padding: '76px clamp(20px, 6vw, 80px) 44px', display: 'grid', gap: 22, maxWidth: 1120 }}>
        <p className="qv-eyebrow" style={{ margin: 0 }}>About Chrism</p>
        <h1 style={{ margin: 0, fontSize: 'clamp(48px, 7vw, 88px)', lineHeight: 0.95, letterSpacing: '-0.05em' }}>
          Simple tools for local organizations that run on service, volunteers, and memory.
        </h1>
        <p className="qv-section-subtitle" style={{ margin: 0, maxWidth: 760, fontSize: 22, lineHeight: 1.45 }}>
          Chrism helps councils, parishes, ministries, and local service groups keep people connected without needing a custom website, messy spreadsheets, or one exhausted person holding everything together.
        </p>
      </section>

      <section id="what" style={{ padding: '34px clamp(20px, 6vw, 80px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
        {[
          ['Public pages', 'Generated local organization pages give members and visitors a clear place to learn what is happening.'],
          ['Events and RSVPs', 'Publish events, collect responses, manage volunteers, and make calendar links easy to share.'],
          ['Member continuity', 'Keep directories, roles, lists, and local knowledge from disappearing when leadership changes.'],
          ['Communication support', 'Help admins follow up, remind, report, and thank people without rebuilding the same process every time.'],
        ].map(([title, body]) => (
          <article key={title} className="qv-card" style={{ display: 'grid', gap: 10 }}>
            <h2 className="qv-section-title" style={{ margin: 0, fontSize: 28 }}>{title}</h2>
            <p className="qv-section-subtitle" style={{ margin: 0 }}>{body}</p>
          </article>
        ))}
      </section>

      <section style={{ padding: '34px clamp(20px, 6vw, 80px)' }}>
        <div style={{ background: 'var(--qv-plum)', color: 'white', padding: '42px clamp(28px, 5vw, 58px)', borderRadius: 8, display: 'grid', gap: 16 }}>
          <p style={{ margin: 0, opacity: 0.78, fontWeight: 800 }}>Why it exists</p>
          <h2 style={{ margin: 0, maxWidth: 900, fontSize: 'clamp(32px, 4vw, 56px)', lineHeight: 1.08 }}>
            Most local groups need a working system more than they need another beautiful-but-abandoned website.
          </h2>
          <p style={{ margin: 0, maxWidth: 780, fontSize: 18, lineHeight: 1.55, opacity: 0.86 }}>
            Chrism is built to make the practical work easier: publishing events, gathering RSVPs, keeping volunteer information organized, and helping new leaders understand what happened before they arrived.
          </p>
        </div>
      </section>

      <section id="pricing" style={{ padding: '34px clamp(20px, 6vw, 80px) 80px', display: 'grid', gap: 22 }}>
        <div>
          <p className="qv-eyebrow" style={{ margin: '0 0 8px' }}>Pricing direction</p>
          <h2 className="qv-section-title" style={{ margin: 0 }}>Built to be useful before it asks to be paid for.</h2>
          <p className="qv-section-subtitle" style={{ marginTop: 10, maxWidth: 760 }}>
            The core public presence, directory, events, and RSVP foundations are intended to stay accessible. Paid tiers focus on operational relief: automation, reporting, saved lists, reminders, and leadership continuity.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
          {[
            ['Community', 'Core local organization tools for public pages, events, RSVPs, and essential admin work.'],
            ['Chrism Care', 'Automation, reminders, reporting, saved lists, and practical follow-up support for busy leaders.'],
            ['Network', 'Future tools for umbrella bodies supporting many local organizations.'],
          ].map(([title, body]) => (
            <article key={title} className="qv-card" style={{ display: 'grid', gap: 10 }}>
              <h3 className="qv-section-title" style={{ margin: 0, fontSize: 28 }}>{title}</h3>
              <p className="qv-section-subtitle" style={{ margin: 0 }}>{body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
