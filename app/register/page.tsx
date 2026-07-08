import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import CleanCurrentUrl from '@/app/components/clean-current-url'
import RegisterForm from './register-form'
import VerifyRegistrationCodeForm from './verify-registration-code-form'
import styles from '../auth-surface.module.css'

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
    <main className={styles.page}>
      <CleanCurrentUrl />
      <div className={styles.shell}>
        <div className={styles.surface}>
          <section className={styles.showcase} aria-label="Chrism registration introduction">
            <div className={styles.showcaseMedia} aria-hidden="true" />

            <div className={styles.carousel}>
              <article className={styles.carouselCard}>
                <p className={styles.carouselEyebrow}>MINISTRY CONTACTS</p>
                <h2 className={styles.carouselTitle}>Help your ministry keep your information accurate.</h2>
                <p className={styles.carouselBody}>
                  Register with your name and contact details so ministry leaders can reach you about events, volunteering, and local administration.
                </p>
              </article>
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
              <h1 className={styles.panelTitle}>Register with Chrism</h1>
              <p className={styles.panelText}>
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

            <div className={styles.footerLinkRow}>
              <Link href="/login" className="qv-auth-footer-link">
                Already registered? Sign in
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
