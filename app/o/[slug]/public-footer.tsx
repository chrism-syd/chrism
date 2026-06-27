import Link from 'next/link'

type PublicFooterProps = {
  displayTitle: string
  poweredByText: string
}

export default function PublicFooter({ displayTitle, poweredByText }: PublicFooterProps) {
  return (
    <footer className="local-page-footer">
      <div className="local-page-footer-copy">
        <strong>{displayTitle}</strong>
        <span>{poweredByText}</span>
      </div>
      <Link href="/about" className="qv-link-button qv-button-secondary">About Chrism</Link>
    </footer>
  )
}
