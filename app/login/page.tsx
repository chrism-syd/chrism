'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { buildAuthConfirmRedirectUrl, sanitizeNextPath } from '@/lib/auth/redirects'
import { getLoginMessage } from '@/lib/auth/login-errors'
import styles from '../auth-surface.module.css'

type LoginSlide = {
  eyebrow: string
  title: string
  body: string
}

type MessageTone = 'neutral' | 'error'

const LOGIN_SLIDES: LoginSlide[] = [
  {
    eyebrow: 'BUILT FOR MINISTRY',
    title: 'Tools built for the way ministry really works.',
    body: 'Tools for Catholic communities to stay organized without losing the pastoral heart. Members, events, and outreach in one thoughtful place.',
  },
  {
    eyebrow: 'MINISTRY MANAGEMENT',
    title: 'Keep your local ministry organized.',
    body: 'Member records, event planning, volunteering, and follow-up tools help ministry teams care for the people they serve.',
  },
  {
    eyebrow: 'FOSTERING COMMUNITY',
    title: 'Gathering, follow-up, and care in one place',
    body: 'Whether you\'re coordinating volunteers or simply staying in touch, Chrism keeps the work gentle and the connections strong.',
  },
]

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<MessageTone>('neutral')
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
  const messageClassName = `qv-inline-message qv-auth-message${messageTone === 'error' ? ' qv-inline-error' : ''}`
  const messageStyle = messageTone === 'error'
    ? { color: 'var(--danger-soft)', fontWeight: 650 }
    : undefined

  async function handleSendLoginCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setMessageTone('neutral')

    const supabase = createClient()
    const nextPath = searchParams.get('next')
    const emailRedirectTo = buildAuthConfirmRedirectUrl(window.location.origin, nextPath)
    const normalizedEmail = email.trim().toLowerCase()

    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo,
      },
    })

    if (error) {
      setMessage(getLoginMessage(error))
      setMessageTone('error')
      setEmailSentTo(null)
      setLoading(false)
      return
    }

    setEmail(normalizedEmail)
    setEmailSentTo(normalizedEmail)
    setVerificationCode('')
    setMessage('We sent a verification code. Keep this window open and enter the code below.')
    setMessageTone('neutral')
    setLoading(false)
  }

  async function handleVerifyLoginCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!emailSentTo) return

    setLoading(true)
    setMessage('')
    setMessageTone('neutral')

    const cleanedCode = verificationCode.replace(/\D/g, '')
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      email: emailSentTo,
      token: cleanedCode,
      type: 'email',
    })

    if (error) {
      setMessage(error.message)
      setMessageTone('error')
      setLoading(false)
      return
    }

    const nextPath = sanitizeNextPath(searchParams.get('next')) ?? '/'
    router.push(nextPath)
    router.refresh()
  }

  function resetForm() {
    setEmail('')
    setVerificationCode('')
    setEmailSentTo(null)
    setMessage('')
    setMessageTone('neutral')
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.surface}>
          <section className={styles.showcase} aria-label="Chrism introduction">
            <div className={styles.showcaseMedia} aria-hidden="true" />

            <div className={styles.carousel} aria-live="polite">
              <article className={styles.carouselCard} key={activeSlideIndex}>
                <p className={styles.carouselEyebrow}>{activeSlide.eyebrow}</p>
                <h2 className={styles.carouselTitle}>{activeSlide.title}</h2>
                <p className={styles.carouselBody}>{activeSlide.body}</p>
              </article>
            </div>

            <div className={styles.showcaseFooter}>
              <div className={styles.carouselIndicators} aria-label="Carousel slides">
                {LOGIN_SLIDES.map((slide, index) => {
                  const isActive = index === activeSlideIndex
                  return (
                    <button
                      key={slide.eyebrow}
                      type="button"
                      className={`${styles.indicator}${isActive ? ` ${styles.indicatorActive}` : ''}`}
                      aria-label={`Show slide ${index + 1}`}
                      aria-pressed={isActive}
                      onClick={() => setActiveSlideIndex(index)}
                    />
                  )
                })}
              </div>

              <p className={styles.photoCredit}>Photo by Akira Hojo on Unsplash</p>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelLogo}>
              <Image
                src="/Chrism_horiz.svg"
                alt="Chrism"
                width={419}
                height={98}
                priority
                className={styles.panelLogoImage}
              />
            </div>

            <div className={styles.panelCopy}>
              <h1 className={styles.panelTitle}>Sign in</h1>
              <p className={styles.panelText}>
                Enter your email address and we&apos;ll send you a verification code. No password needed.
              </p>
            </div>

            {emailSentTo ? (
              <form onSubmit={handleVerifyLoginCode} className="qv-form-grid qv-register-form">
                <div className="qv-auth-success-state">
                  <div className="qv-auth-success-icon" aria-hidden="true">#</div>
                  <div className="qv-auth-success-copy">
                    <h2 className="qv-section-title">Enter your verification code</h2>
                    <p className="qv-auth-success-text">
                      We sent a verification code to <strong>{emailSentTo}</strong>. Keep this window open and enter it here.
                    </p>
                  </div>
                </div>

                <label className="qv-field">
                  <span>Verification code</span>
                  <input
                    name="token"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    placeholder="Enter code"
                    required
                  />
                </label>

                <div className="qv-form-actions" style={{ justifyContent: 'flex-start' }}>
                  <button type="submit" disabled={loading} className="qv-button-primary">
                    {loading ? 'Verifying...' : 'Verify and sign in'}
                  </button>
                  <button type="button" className="qv-button-secondary" onClick={resetForm} disabled={loading}>
                    Use a different email
                  </button>
                </div>

                {message ? <p className={messageClassName} style={messageStyle}>{message}</p> : null}
              </form>
            ) : (
              <>
                <form onSubmit={handleSendLoginCode} className={styles.loginForm}>
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
                    {loading ? 'Sending...' : 'Send code'}
                  </button>
                </form>

                {message ? <p className={messageClassName} style={messageStyle}>{message}</p> : null}
              </>
            )}

            <div className={styles.footerLinkRow}>
              <Link href="/register" className="qv-auth-footer-link">
                Register with Chrism
              </Link>
            </div>
          </section>
        </div>

        <div className={styles.surfaceLinkRow}>
          <Link href="/about" className="qv-auth-footer-link">
            About us
          </Link>
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
