import Link from 'next/link'
import AppHeader from '@/app/app-header'

export default async function NotFound() {
  return (
    <main className="qv-page qv-404-page">
      <div className="qv-shell qv-404-shell">
        <AppHeader />

        <section className="qv-404-scene" aria-labelledby="not-found-title">
          <div className="qv-404-ghost" aria-hidden="true">
            404
          </div>

          <div className="qv-404-hero">
            <h1 id="not-found-title" className="qv-404-headline">
              I have gone <em>astray</em> like a lost sheep.
            </h1>
            <p className="qv-404-reference">Psalm 119:176</p>

            <div className="qv-404-actions">
              <Link href="/" className="qv-404-home-button">
                Let&apos;s go home
              </Link>
            </div>
          </div>

          <div className="qv-404-sheep-wrap" aria-hidden="true">
            <div className="qv-404-sheep">
              <div className="qv-404-ground-shadow" />

              <div className="qv-404-legs">
                <div className="qv-404-leg qv-404-leg-1" />
                <div className="qv-404-leg qv-404-leg-2" />
                <div className="qv-404-leg qv-404-leg-3" />
                <div className="qv-404-leg qv-404-leg-4" />
              </div>

              <div className="qv-404-wool">
                <div className="qv-404-piece-of-wool qv-404-piece-of-wool-1" />

                <div className="qv-404-wool-shadowlayer">
                  <div className="qv-404-piece-of-wool qv-404-piece-of-wool-5" />
                  <div className="qv-404-piece-of-wool qv-404-piece-of-wool-6" />
                  <div className="qv-404-piece-of-wool qv-404-piece-of-wool-7" />
                  <div className="qv-404-piece-of-wool qv-404-piece-of-wool-8" />
                  <div className="qv-404-piece-of-wool qv-404-piece-of-wool-9" />
                </div>

                <div className="qv-404-wool-toplayer">
                  <div className="qv-404-piece-of-wool qv-404-piece-of-wool-2" />
                  <div className="qv-404-piece-of-wool qv-404-piece-of-wool-3" />
                  <div className="qv-404-piece-of-wool qv-404-piece-of-wool-4" />
                  <div className="qv-404-piece-of-wool qv-404-piece-of-wool-5" />
                  <div className="qv-404-piece-of-wool qv-404-piece-of-wool-6" />
                  <div className="qv-404-piece-of-wool qv-404-piece-of-wool-7" />
                  <div className="qv-404-piece-of-wool qv-404-piece-of-wool-8" />
                  <div className="qv-404-piece-of-wool qv-404-piece-of-wool-9" />
                  <div className="qv-404-piece-of-wool qv-404-piece-of-wool-10" />
                </div>
              </div>

              <div className="qv-404-head">
                <div className="qv-404-head-face-front" />
                <div className="qv-404-head-face" />
                <div className="qv-404-head-shadow" />

                <div className="qv-404-ear qv-404-ear-1" />
                <div className="qv-404-ear qv-404-ear-2" />
                <div className="qv-404-ear qv-404-ear-2 qv-404-ear-shadow" />

                <div className="qv-404-eye qv-404-eye-1">
                  <div className="qv-404-glow" />
                </div>
                <div className="qv-404-eye qv-404-eye-2">
                  <div className="qv-404-glow" />
                </div>

                <div className="qv-404-wool-head">
                  <div className="qv-404-wool-shadowlayer">
                    <div className="qv-404-piece-of-wool qv-404-piece-of-wool-1" />
                    <div className="qv-404-piece-of-wool qv-404-piece-of-wool-2" />
                    <div className="qv-404-piece-of-wool qv-404-piece-of-wool-3" />
                  </div>
                  <div className="qv-404-piece-of-wool qv-404-piece-of-wool-1" />
                  <div className="qv-404-piece-of-wool qv-404-piece-of-wool-2" />
                  <div className="qv-404-piece-of-wool qv-404-piece-of-wool-3" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
