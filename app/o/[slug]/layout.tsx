import type { ReactNode } from 'react'
import './public-page.css'
import './public-gallery.css'
import './public-contact-expander.css'
import PublicContactFormExpander from './public-contact-form-expander'

export default function PublicLocalOrganizationLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PublicContactFormExpander />
    </>
  )
}
