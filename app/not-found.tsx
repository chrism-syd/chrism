import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="qv-page">
      <div className="qv-shell">
        <section className="qv-hero-card" style={{ marginTop: 48 }}>
          <p className="qv-eyebrow">404</p>
          <h1 className="qv-title">This page has gone wandering.</h1>
          <p className="qv-subtitle" style={{ maxWidth: 640 }}>
            The page you asked for does not exist, or it has been moved somewhere else in Chrism.
          </p>

          <div
            style={{
              marginTop: 24,
              display: 'grid',
              gap: 16,
              padding: 20,
              borderRadius: 20,
              border: '1px solid var(--divider)',
              background: 'var(--bg-sunken)',
            }}
          >
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              Try heading back to your profile, the member directory, or the home page.
            </p>

            <div className="qv-form-actions" style={{ margin: 0 }}>
              <Link href="/" className="qv-link-button qv-button-primary">
                Go home
              </Link>
              <Link href="/me" className="qv-link-button qv-button-secondary">
                Open profile
              </Link>
              <Link href="/members" className="qv-link-button qv-button-secondary">
                Member directory
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
