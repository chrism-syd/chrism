import Image from 'next/image'
import Link from 'next/link'
import styles from './chrism-works-audience-menu.module.css'

type Audience = 'business' | 'ministry' | 'schools'
type Placement = 'hero' | 'inline'

const menuPieceStyle = {
  height: 'clamp(15px, 1.55vw, 22px)',
  width: 'auto',
  display: 'block',
} as const

function audienceClass(current: Audience, audience: Audience) {
  return current === audience ? styles.stickyCurrent : `${styles.stickyLink} ${styles.stickyInactive}`
}

function ariaCurrent(current: Audience, audience: Audience): 'page' | undefined {
  return current === audience ? 'page' : undefined
}

export function ChrismWorksAudienceMenu({ current = 'business', placement = 'hero' }: { current?: Audience; placement?: Placement }) {
  const shellClassName = placement === 'inline' ? `${styles.stickyAudienceShell} ${styles.inlineAudienceShell}` : styles.stickyAudienceShell

  return (
    <div className={shellClassName}>
      <nav className={styles.stickyAudienceNav} aria-label="Chrismworks audience navigation">
        <Link href="/" className={styles.stickyBrand} aria-label="Chrismworks home">
          <Image src="/menu-chrism.svg" alt="" width={260} height={100} style={menuPieceStyle} />
          <Image src="/menu-works.svg" alt="" width={260} height={100} style={menuPieceStyle} />
        </Link>
        <Image src="/menu-for.svg" alt="for" width={120} height={100} style={menuPieceStyle} />
        <Link href="/" className={audienceClass(current, 'business')} aria-current={ariaCurrent(current, 'business')}>
          <Image src="/menu-business.svg" alt="Business" width={280} height={100} style={menuPieceStyle} />
        </Link>
        <Image src="/menu-vdiv.svg" alt="" width={40} height={100} style={menuPieceStyle} />
        <Link href="/ministry" className={audienceClass(current, 'ministry')} aria-current={ariaCurrent(current, 'ministry')}>
          <Image src="/menu-ministry.svg" alt="Ministry" width={260} height={100} style={menuPieceStyle} />
        </Link>
        <Image src="/menu-vdiv.svg" alt="" width={40} height={100} style={menuPieceStyle} />
        <Link href="/schools" className={audienceClass(current, 'schools')} aria-current={ariaCurrent(current, 'schools')}>
          <Image src="/menu-schools.svg" alt="Schools" width={240} height={100} style={menuPieceStyle} />
        </Link>
      </nav>
      <button className={styles.mobileMenuButton} type="button" aria-label="Open menu">
        <span />
        <span />
        <span />
      </button>
    </div>
  )
}

export function ChrismWorksFooterLogo() {
  return (
    <div className={styles.footerLogoWrap}>
      <Link href="/" className={styles.footerLogoLink} aria-label="Chrism home">
        <Image src="/Chrism_horiz.svg" alt="Chrism" width={419} height={98} className={styles.footerLogoImage} />
      </Link>
    </div>
  )
}
