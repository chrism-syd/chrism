'use client'

import { useRef } from 'react'
import styles from './school-landing.module.css'

function noOrphan(text: string) {
  return text.replace(/\s+(\S+)$/, '\u00a0$1')
}

const supplyCards = [
  {
    title: (
      <>
        Print &amp;
        <br />
        Stationery
      </>
    ),
    label: 'Print and Stationery',
    copy:
      'Flyers, brochures, booklets, posters, newsletters, presentation folders, letterhead, forms, numbered tickets, wall calendars, and greeting cards. If it goes through a commercial press, we can source it.',
  },
  {
    title: (
      <>
        Event &amp;
        <br />
        Signage
      </>
    ),
    label: 'Event and Signage',
    copy:
      'Banners, large format prints, coroplast signs, retractable displays, step-and-repeat backdrops, yard signs, and flags. Built for school events, spirit days, graduations, and community fundraisers.',
  },
  {
    title: (
      <>
        Apparel &amp;
        <br />
        Uniforms
      </>
    ),
    label: 'Apparel and Uniforms',
    copy:
      'Custom screen-printed and embroidered t-shirts, hoodies, crewneck sweatshirts, and staff polos. Brands include Gildan, Bella+Canvas, and Champion. Grad jackets and team uniforms sourced on request.',
  },
  {
    title: (
      <>
        Promotional
        <br />
        Products
      </>
    ),
    label: 'Promotional Products',
    copy:
      'Tents, umbrellas, pennants, lanyards, drinkware, tote bags, and branded stationery — sourced through commercial promotional vendors at trade pricing.',
  },
  {
    title: (
      <>
        Spirit &amp;
        <br />
        Recognition
      </>
    ),
    label: 'Spirit and Recognition',
    copy:
      'Certificates, award ribbons, custom grad keepsakes, and pennants. Designed and sourced to reflect the dignity of the occasion.',
  },
]

export default function SchoolSuppliesSection() {
  const railRef = useRef<HTMLDivElement>(null)

  function scrollSupplyCards(direction: 'previous' | 'next') {
    const rail = railRef.current
    if (!rail) return

    const scrollDistance = Math.max(rail.clientWidth * 0.86, 320)

    rail.scrollBy({
      left: direction === 'next' ? scrollDistance : -scrollDistance,
      behavior: 'smooth',
    })
  }

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

      <div className={styles.suppliesRailShell}>
        <div ref={railRef} className={styles.suppliesRail} aria-label="School supply categories">
          {supplyCards.map((card) => (
            <article key={card.label} className={styles.supplyCard}>
              <h3>{card.title}</h3>
              <p>{noOrphan(card.copy)}</p>
            </article>
          ))}
        </div>

        <div className={styles.carouselControls} aria-label="Supply carousel controls">
          <button type="button" onClick={() => scrollSupplyCards('previous')} aria-label="Previous supply categories">
            ←
          </button>
          <button type="button" onClick={() => scrollSupplyCards('next')} aria-label="Next supply categories">
            →
          </button>
        </div>
      </div>
    </section>
  )
}
