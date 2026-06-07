import styles from './school-landing.module.css'

function noOrphan(text: string) {
  return text.replace(/\s+(\S+)$/, '\u00a0$1')
}

const howSteps = [
  {
    title: 'Request a quote',
    copy:
      'Send us your project details or an existing invoice and we\'ll come back with pricing. Most quotes are turned around within one business day.',
  },
  {
    title: 'We handle production',
    copy:
      'Once approved, we manage the order from file preparation through to production. You have one point of contact — no chasing multiple vendors.',
  },
  {
    title: 'Delivery',
    copy:
      'Finished goods are shipped directly to your school or institution. Rush orders can be personally delivered within the local area.',
  },
  {
    title: 'Payment',
    copy:
      'We\'re flexible. Chrism works within your institution\'s existing procurement procedures, including purchase orders and formal payment terms. We accept e-transfer, institutional cheques, and credit card. HST number available upon request.',
  },
]

export default function SchoolHowItWorksSection() {
  return (
    <section className={styles.howSection}>
      <div className={styles.howIntro}>
        <p className={styles.eyebrow}>How it works</p>
        <h2>Getting started is straightforward.</h2>
        <p>
          {noOrphan(
            'There\'s no complicated onboarding — just tell us what you need and we\'ll take it from there.'
          )}
        </p>
      </div>

      <div className={styles.howGrid}>
        {howSteps.map((step, index) => (
          <article key={step.title} className={styles.howCard}>
            <p className={styles.supplyNumber}>{String(index + 1).padStart(2, '0')}</p>
            <h3>{step.title}</h3>
            <p>{noOrphan(step.copy)}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
