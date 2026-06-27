import type { ReactNode } from 'react'
import NeutralContactPlaceholders from './neutral-contact-placeholders'

export default function PublicPageSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <NeutralContactPlaceholders />
    </>
  )
}
