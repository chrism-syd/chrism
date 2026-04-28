'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { buildAuthConfirmRedirectUrl } from '@/lib/auth/redirects'
import { getLoginMessage } from '@/lib/auth/login-errors'

type LoginSlide = {
  eyebrow: string
  title: string
  body: string
}

const LOGIN_SLIDES: LoginSlide[] = [
  {
    eyebrow: 'BUILT FOR MINISTRY',
    title: 'Tools built for the way ministry really works.',
    body: 'Tools for Catholic communities to stay organized without losing the pastoral heart. Members, events, and outreach in one thoughtful place.',
  },
  {
    eyebrow: 'ROOTED IN FAITH',
    title: 'A companion for your spiritual life.',
    body: 'Daily scripture, guided prayer, and the Rosary. Chrism helps you bring your real life before God — calm, grounded, and faithful.',
  },
  {
    eyebrow: 'FOSTERING COMMUNITY',
    title: 'Gathering, follow-up, and care in one place',
    body: 'Whether you\'re coordinating volunteers or simply staying in touch, Chrism keeps the work gentle and the connections strong.',
  },
]

function LoginPageContent() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null)
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlideIndex((current) => (current + 1) % LOGIN_SLIDES.length)
    }, 8000)

    return () => window.clearInterval(timer)
  }, [])

  const activeSlide = useMemo(
    () => LOGIN_SLIDES[activeSlideIndex] ?? LOGIN_SLIDES[0],
    [activeSlideIndex]
  )

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    const supabase = createClient()
    const nextPath = searchParams.get('next')
    const emailRedirectTo = buildAuthConfirmRedirectUrl(window.location.origin, nextPath)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo,
      },
    })

    if (error) {
      setMessage(getLoginMessage(error))
      setEmailSentTo(null)
      setLoading(false)
      return
    }

    setEmailSentTo(email)
    setMessage(getLoginMessage(null))
    setLoading(false)
  }

  function resetForm() {
    setEmail('')
    setEmailSentTo(null)
    setMessage('')
  }

  return (
    <main className="qv-page qv-login-page">
      <div className="qv-login-shell">
        <div className="qv-login-surface">
          <section className="qv-login-showcase" aria-label="Chrism introduction">
            <div className="qv-login-showcase-media">
              <Image
                src="/akira-hojo-_86u_Y0oAaM-unsplash.jpg"
                alt=""
                fill
                priority
                className="qv-login-showcase-image"
              />
            </div>

            <div className="qv-login-carousel" aria-live="polite">
              <article className="qv-login-carousel-card" key={activeSlideIndex}>
                <p className="qv-login-carousel-eyebrow">{activeSlide.eyebrow}</p>
                <h2 className="qv-login-carousel-title">{activeSlide.title}</h2>
                <p className="qv-login-carousel-body">{activeSlide.body}</p>
              </article>
            </div>

            <div className="qv-login-showcase-footer">
              <div className="qv-login-carousel-indicators" aria-label="Carousel slides">
                {LOGIN_SLIDES.map((slide, index) => {
                  const isActive = index === activeSlideIndex
                  return (
                    <button
                      key={slide.eyebrow}
                      type="button"
                      className={`qv-login-indicator${isActive ? ' is-active' : ''}`}
                      aria-label={`Show slide ${index + 1}`}
                      aria-pressed={isActive}
                      onClick={() => setActiveSlideIndex(index)}
                    />
                  )
                })}
              </div>

              <p className="qv-login-photo-credit">
                Photo by{' '}
                <a
                  href="https://unsplash.com/@joephotography?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"
                  target="_blank"
                  rel="noreferrer"
                >
                  Akira Hojo
                </a>{' '}
                on{' '}
                <a
                  href="https://unsplash.com/photos/photo-of-brown-church-_86u_Y0oAaM?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"
                  target="_blank"
                  rel="noreferrer"
                >
                  Unsplash
                </a>
              </p>
            </div>
          </section>

          <section className="qv-login-panel">
            <div className="qv-login-panel-logo">
              <Image
                src="/Chrism_horiz.svg"
                alt="Chrism"
                width={419}
                height={98}
                priority
                className="qv-login-panel-logo-image"
              />
            </div>

            <div className="qv-login-panel-copy">
              <h1 className="qv-login-panel-title">Sign in with a secure link</h1>
              <p className="qv-login-panel-text">
                Enter your email address and we will send you a secure sign-in link.
              </p>
            </div>

            {emailSentTo ? (
              <div className="qv-auth-success-state">
                <div className="qv-auth-success-icon" aria-hidden="true">✓</div>
                <div className="qv-auth-success-copy">
                  <h2 className="qv-section-title">Check your email</h2>
                  <p className="qv-auth-success-text">
                    We sent a secure sign-in link to <strong>{emailSentTo}</strong>.
                  </p>
                  <p className="qv-auth-success-text">
                    After you click the link, return here if needed and the app will continue your sign-in.
                  </p>
                </div>
                <button type="button" className="qv-button-secondary" onClick={resetForm}>
                  Use a different email
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleLogin} className="qv-login-form">
                  <div className="qv-control">
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Enter your email address"
                      autoComplete="email"
                      required
                    />
                  </div>

                  <button type="submit" disabled={loading} className="qv-button-primary">
                    {loading ? 'Sending...' : 'Send link'}
                  </button>
                </form>

                {message ? <p className="qv-inline-message qv-auth-message">{message}</p> : null}
              </>
            )}

            <div className="qv-login-footer-link-row">
              <Link href="/about" className="qv-auth-footer-link">
                About us
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}
