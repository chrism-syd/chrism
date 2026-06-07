import styles from './school-landing.module.css'

function noOrphan(text: string) {
  return text.replace(/\s+(\S+)$/, '\u00a0$1')
}

const supplyCards = [
  {
    title: 'Print & Stationery',
    copy:
      'Flyers, brochures, booklets, posters, newsletters, presentation folders, letterhead, forms, numbered tickets, wall calendars, and greeting cards. If it goes through a commercial press, we can source it.',
  },
  {
    title: 'Event & Signage',
    copy:
      'Banners, large format prints, coroplast signs, retractable displays, step-and-repeat backdrops, yard signs, and flags. Built for school events, spirit days, graduations, and community fundraisers.',
  },
  {
    title: 'Apparel & Uniforms',
    copy:
      'Custom screen-printed and embroidered t-shirts, hoodies, crewneck sweatshirts, and staff polos. Brands include Gildan, Bella+Canvas, and Champion. Grad jackets and team uniforms sourced on request.',
  },
  {
    title: 'Promotional Products',
    copy:
      'Tents, umbrellas, pennants, lanyards, drinkware, tote bags, and branded stationery — sourced through commercial promotional vendors at trade pricing.',
  },
  {
    title: 'Spirit & Recognition',
    copy:
      'Certificates, award ribbons, custom grad keepsakes, and pennants. Designed and sourced to reflect the dignity of the occasion.',
  },
]

export default function SchoolSuppliesSection() {
  return (
    <section className={styles.suppliesSection}>
      <div className={styles.suppliesIntro}>
        <p className={styles.eyebrow}>What we supply</p>
        <h2>Print, apparel, signage, and promotional sourcing without the vendor shuffle.</h2>
        <p>
          {noOrphan(
            'Chrism sources and manages production across print, apparel, signage, and promotional products — handling everything from quote to delivery so your school or board doesn\'t have to manage multiple vendors.'
          )}
        </p>
      </div>

      <div className={styles.suppliesRail} aria-label="School supply categories">
        {supplyCards.map((card, index) => (
          <article key={card.title} className={styles.supplyCard}>
            <p className={styles.supplyNumber}>{String(index + 1).padStart(2, '0')}</p>
            <h3>{card.title}</h3>
            <p>{noOrphan(card.copy)}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
