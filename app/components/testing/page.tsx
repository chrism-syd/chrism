import Link from 'next/link'
import AppHeader from '@/app/app-header'
import { getAppSiteMapSections } from '@/lib/dev/app-sitemap'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function TestingSiteMapPage() {
  const sections = getAppSiteMapSections()
  const totalPages = sections.reduce((count, section) => count + section.entries.length, 0)
  const staticPages = sections.reduce(
    (count, section) => count + section.entries.filter((entry) => !entry.isDynamic).length,
    0
  )
  const dynamicPages = totalPages - staticPages

  return (
    <main className="qv-page">
      <div className="qv-shell">
        <AppHeader />

        <section className="qv-card qv-compact-card">
          <p className="qv-detail-label">Testing surface map</p>
          <h1 className="qv-section-title" style={{ marginTop: 8 }}>Page sitemap</h1>
          <p className="qv-section-subtitle" style={{ marginTop: 10 }}>
            This page scans the App Router and groups every <code>page.tsx</code> route by flow so you can give each surface a set of eyes.
            Static routes are clickable. Dynamic routes are still listed, but they need a real ID or token before you can open them.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 12,
              marginTop: 20,
            }}
          >
            {[
              { label: 'Total pages', value: totalPages },
              { label: 'Static routes', value: staticPages },
              { label: 'Dynamic routes', value: dynamicPages },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  border: '1px solid var(--divider)',
                  borderRadius: 16,
                  background: 'var(--bg-sunken)',
                  padding: 16,
                }}
              >
                <div className="qv-detail-label">{stat.label}</div>
                <div className="qv-detail-value" style={{ marginTop: 6 }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </section>

        <div style={{ display: 'grid', gap: 18, marginTop: 18 }}>
          {sections.map((section) => (
            <section key={section.key} className="qv-card qv-compact-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <h2 className="qv-section-title" style={{ margin: 0 }}>{section.label}</h2>
                <span className="qv-mini-pill">{section.entries.length} page{section.entries.length === 1 ? '' : 's'}</span>
              </div>

              <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                {section.entries.map((entry) => (
                  <div
                    key={entry.filePath}
                    style={{
                      border: '1px solid var(--divider)',
                      borderRadius: 16,
                      background: 'var(--bg-sunken)',
                      padding: 16,
                      display: 'grid',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      <div>
                        <div className="qv-detail-label">{entry.routeLabel}</div>
                        {entry.isDynamic ? (
                          <div className="qv-detail-value" style={{ marginTop: 4 }}>{entry.route}</div>
                        ) : (
                          <Link href={entry.route} className="qv-member-link" style={{ display: 'inline-block', marginTop: 4 }}>
                            {entry.route}
                          </Link>
                        )}
                      </div>
                      <span className="qv-mini-pill">{entry.isDynamic ? 'Dynamic params needed' : 'Openable now'}</span>
                    </div>
                    <div className="qv-member-meta" style={{ margin: 0 }}>
                      {entry.filePath}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
