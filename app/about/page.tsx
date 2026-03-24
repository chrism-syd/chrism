import Link from 'next/link'
import AppHeader from '@/app/app-header'

export default function AboutPage() {
  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-hero-card">
          <p className="qv-eyebrow">About Chrism</p>
          <h1 className="qv-title">Built for Catholic ministry</h1>
          <p className="qv-subtitle">
            Practical, respectful software for the people doing the work of member care, outreach, and faith formation.
          </p>
        </section>

        <section className="qv-card">
          <div className="qv-prose-block">
            <p>Chrism is a member engagement platform built for Catholic ministry.</p>
            <p>
              Most ministries run on care: volunteers who show up, leaders who remember names, members who stay connected
              across seasons of life. What they rarely have is a simple, affordable tool built to support that work.
              Enterprise CRM software wasn&apos;t designed for parish life. Spreadsheets don&apos;t scale. And the people doing
              this work deserve better than cobbled-together workarounds.
            </p>
            <p>
              Chrism is being built around two pillars that sit at the heart of Catholic ministry life: community and
              faith.
            </p>
            <p>
              On the community side, Chrism gives organizations a practical way to manage members, organize events,
              coordinate volunteers, and stay connected to the people who make ministry work — including those who are
              active, those who are less able to participate, and those who have drifted away.
            </p>
            <p>
              On the faith side, Chrism is being built to grow into a spiritual companion: a place for prayer, devotion,
              and guided faith content that can serve both members and the broader parish community.
            </p>
            <p>
              Core member functionality will be free for organizations. The essential tools of member care and
              engagement should be accessible to every ministry, not just the ones with budget.
            </p>
            <p>
              Over time, Chrism will also become a tool for re-engagement and outreach — helping ministries welcome new
              people, reconnect with inactive members, and build stronger pathways into parish life.
            </p>

            <div>
              <h2 className="qv-section-title">Chrism is designed for real ministry use:</h2>
              <ul className="qv-prose-list">
                <li>member directories and records</li>
                <li>events and volunteer coordination</li>
                <li>outreach and follow-up through custom lists</li>
                <li>tools that help ministries care for people who are active, disengaged, homebound, or simply harder to reach</li>
              </ul>
            </div>

            <p>
              We are building Chrism to be practical, respectful, and humane: software that supports ministry without
              trying to replace it.
            </p>
          </div>
        </section>

        <section className="qv-card">
          <div className="qv-prose-block">
            <h2 className="qv-section-title">Security and Privacy</h2>
            <p>Church communities trust us with personal information, and we take that seriously.</p>
            <p>
              Chrism is built with secure modern infrastructure, with strong access controls, authenticated access, and
              careful separation of organizational data. Sensitive member information is only visible to the people who
              need it to carry out their role.
            </p>
            <p>
              Privacy isn&apos;t just a policy in Chrism — it&apos;s part of the product itself: limited access, purpose-based
              visibility, and a strong bias toward protecting member information from unnecessary exposure.
            </p>
          </div>

          <div className="qv-form-actions" style={{ justifyContent: 'flex-start', marginTop: 20 }}>
            <Link href="/login" className="qv-button-secondary qv-link-button">
              Back to sign in
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
