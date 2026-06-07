import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import CleanCurrentUrl from '@/app/components/clean-current-url'
import RegisterForm from './register-form'
import VerifyRegistrationCodeForm from './verify-registration-code-form'

export const metadata: Metadata = {
  title: 'Register | Chrism',
}

type RegisterPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const errorMessage = typeof resolvedSearchParams.error === 'string' ? resolvedSearchParams.error : null
  const noticeMessage = typeof resolvedSearchParams.notice === 'string' ? resolvedSearchParams.notice : null
  const defaultEmail = typeof resolvedSearchParams.email === 'string' ? resolvedSearchParams.email : null
  const isVerificationStep = Boolean(defaultEmail && noticeMessage)

  return (
    <main className="qv-page qv-login-page">
      <CleanCurrentUrl />
      <div className="qv-login-shell">
        <div className="qv-login-surface">
          <section className="qv-login-showcase" aria-label="Chrism registration introduction">
            <div className="qv-login-showcase-media">
              <Image
                src="/akira-hojo-_86u_Y0oAaM-unsplash.jpg"
                alt=""
                fill
                priority
                className="qv-login-showcase-image"
              />
            </div>

            <div className="qv-login-carousel">
              <article className="qv-login-carousel-card">
                <p className="qv-login-carousel-eyebrow">MINISTRY CONTACTS</p>
                <h2 className="qv-login-carousel-title">Help your ministry keep your information accurate.</h2>
                <p className="qv-login-carousel-body">
                  Register with your name and contact details so ministry leaders can reach you about events, volunteering, and local administration.
                </p>
              </article>
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
              <h1 className="qv-login-panel-title">Register with Chrism</h1>
              <p className="qv-login-panel-text">
                No password needed. We will email you a verification code after you submit your details.
              </p>
            </div>

            {errorMessage ? <p className="qv-inline-message qv-inline-error">{errorMessage}</p> : null}
            {noticeMessage ? <p className="qv-inline-message qv-inline-success">{noticeMessage}</p> : null}

            {isVerificationStep && defaultEmail ? (
              <VerifyRegistrationCodeForm email={defaultEmail} />
            ) : (
              <RegisterForm defaultEmail={defaultEmail} />
            )}

            <div className="qv-login-footer-link-row">
              <Link href="/login" className="qv-auth-footer-link">
                Already registered? Sign in
              </Link>
            </div>
          </section>
        </div>

        <div style={{ marginTop: '14px', textAlign: 'center' }}>
          <Link href="/about" className="qv-auth-footer-link">
            About us
          </Link>
        </div>
      </div>
    </main>
  )
}
