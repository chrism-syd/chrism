import type { ReactNode } from 'react'
import Link from 'next/link'
import FeatureShowcaseContainer from './feature-showcase-container'

function DemoStageCard({
  heading,
  body,
  children,
}: {
  heading: string
  body: string
  children: ReactNode
}) {
  return (
    <div className="qv-testing-stage-card">
      <div className="qv-testing-stage-hero" />
      <div className="qv-testing-stage-overlay">
        <div className="qv-testing-stage-callout">
          <h3 className="qv-testing-stage-callout-title">{heading}</h3>
          <p className="qv-testing-stage-callout-copy">{body}</p>
        </div>

        <div className="qv-testing-stage-content-box">{children}</div>
      </div>
    </div>
  )
}

export default function TestingFeatureShowcasePage() {
  const items = [
    {
      id: 'invite',
      label: 'Invite flow',
      title: 'Invite a council officer to get started',
      description:
        'This uses a lighter inner box for form content so the parent container can still carry richer imagery, diagrams, or other content around it.',
      panelContent: (
        <DemoStageCard
          heading="No meetings have been added to your council calendar."
          body="Let your council officers know that their meeting page on Chrism is blank."
        >
          <div className="qv-form-grid">
            <div>
              <h4 className="qv-testing-form-title">Invite a council officer to get started</h4>
              <p className="qv-section-subtitle" style={{ marginTop: 8 }}>
                We will send a secure email link so they can start Chrism onboarding.
              </p>
            </div>

            <div className="qv-form-row qv-form-row-2">
              <label className="qv-control">
                <span className="qv-label">Name</span>
                <input placeholder="e.g. John Smith" />
              </label>
              <label className="qv-control">
                <span className="qv-label">Email address</span>
                <input type="email" placeholder="name@example.com" />
              </label>
            </div>

            <div className="qv-form-actions">
              <button type="button" className="qv-button-primary">
                Send email
              </button>
            </div>
          </div>
        </DemoStageCard>
      ),
    },
    {
      id: 'content',
      label: 'Flexible content',
      title: 'The stage can hold more than media',
      description:
        'Treat the right side as a container, not a hard-coded image slot. That leaves room for forms, stats, empty states, embedded previews, or mixed layouts.',
      panelContent: (
        <div className="qv-testing-stage-card qv-testing-stage-card-simple">
          <div className="qv-testing-stat-grid">
            <div className="qv-testing-stat-tile">
              <div className="qv-testing-stat-number">3</div>
              <div className="qv-testing-stat-label">Pending invites</div>
            </div>
            <div className="qv-testing-stat-tile">
              <div className="qv-testing-stat-number">12</div>
              <div className="qv-testing-stat-label">Upcoming meetings</div>
            </div>
            <div className="qv-testing-stat-tile">
              <div className="qv-testing-stat-number">2</div>
              <div className="qv-testing-stat-label">Open claims</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'mobile',
      label: 'Mobile behavior',
      title: 'The layout should collapse cleanly',
      description:
        'On smaller screens the stage stacks above the pills, and the active panel becomes a straightforward accordion. Fancy is optional. Usable is not.',
      panelContent: (
        <div className="qv-testing-stage-card qv-testing-stage-card-simple">
          <div className="qv-testing-mobile-frame">
            <div className="qv-testing-mobile-notch" />
            <div className="qv-testing-mobile-screen">
              <div className="qv-testing-mobile-box" />
              <div className="qv-testing-mobile-pill is-active">Invite flow</div>
              <div className="qv-testing-mobile-pill">Approval path</div>
              <div className="qv-testing-mobile-pill">Admin roster</div>
            </div>
          </div>
        </div>
      ),
    },
  ]

  return (
    <main className="qv-page">
      <div className="qv-shell" style={{ maxWidth: 1320 }}>
        <div className="qv-app-header">
          <div>
            <p className="qv-eyebrow">Components / testing</p>
            <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
              Standalone sandbox page for the Apple-inspired showcase container.
            </p>
          </div>
          <Link href="/me/council" className="qv-link-button qv-button-secondary">
            Back to council admin
          </Link>
        </div>

        <FeatureShowcaseContainer
          eyebrow="Exploration"
          title="Feature showcase container"
          intro="A reusable pattern for stacked feature pills on the left and flexible staged content on the right. This version is intentionally simpler than Apple’s small moon-landing of motion design."
          items={items}
          initialItemId="invite"
        />
      </div>
    </main>
  )
}
