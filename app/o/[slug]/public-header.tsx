import Image from 'next/image'
import Link from 'next/link'
import OrganizationAvatar from '@/app/components/organization-avatar'

type PublicHeaderProps = {
  canonicalSlug: string
  displayName: string
  displayTitle: string
  parentBrandName: string
  logoStoragePath: string | null
  logoAltText: string | null
  hasEvents: boolean
  hasOfficers?: boolean
}

export default function PublicHeader({
  canonicalSlug,
  displayName,
  displayTitle,
  parentBrandName,
  logoStoragePath,
  logoAltText,
  hasEvents,
  hasOfficers = false,
}: PublicHeaderProps) {
  return (
    <header className="local-page-header">
      <Link href={`/o/${canonicalSlug}`} className="local-page-header-brand">
        <OrganizationAvatar
          displayName={displayName}
          logoStoragePath={logoStoragePath}
          logoAltText={logoAltText ?? displayTitle}
          size={68}
        />
        <span className="local-page-header-brand-copy">
          <span className="local-page-header-parent">{parentBrandName}</span>
          <strong className="local-page-header-name">{displayName}</strong>
        </span>
      </Link>

      <nav className="local-page-header-nav">
        <a href="#about">About</a>
        {hasEvents ? <a href="#events">Events</a> : null}
        {hasOfficers ? <Link href={`/o/${canonicalSlug}/officers`}>Officers</Link> : null}
        <a href="#contact">Get involved</a>
      </nav>

      <Link href="/about" className="local-page-chrism-powered" aria-label="About Chrism">
        <Image src="/Chrism_horiz.svg" alt="Chrism" width={92} height={31} priority />
      </Link>
    </header>
  )
}
