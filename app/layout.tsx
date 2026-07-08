import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import CleanQueryMessageParams from '@/app/components/clean-query-message-params'
import PendingSubmitEnhancer from '@/app/components/pending-submit-enhancer'
import './globals.css'
import './site-recovery.css'
import './people-pagination-recovery.css'
import './custom-lists-polish.css'
import './auth-polish.css'

const bodyFont = localFont({
  src: [
    { path: '../fonts/AtkinsonHyperlegibleNext-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/AtkinsonHyperlegibleNext-RegularItalic.woff2', weight: '400', style: 'italic' },
    { path: '../fonts/AtkinsonHyperlegibleNext-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/AtkinsonHyperlegibleNext-MediumItalic.woff2', weight: '500', style: 'italic' },
    { path: '../fonts/AtkinsonHyperlegibleNext-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/AtkinsonHyperlegibleNext-SemiBoldItalic.woff2', weight: '600', style: 'italic' },
    { path: '../fonts/AtkinsonHyperlegibleNext-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../fonts/AtkinsonHyperlegibleNext-BoldItalic.woff2', weight: '700', style: 'italic' },
    { path: '../fonts/AtkinsonHyperlegibleNext-ExtraBold.woff2', weight: '800', style: 'normal' },
    { path: '../fonts/AtkinsonHyperlegibleNext-ExtraBoldItalic.woff2', weight: '800', style: 'italic' },
  ],
  variable: '--font-body',
  display: 'swap',
})

const headingFont = localFont({
  src: [
    { path: '../fonts/PlayfairDisplay-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/PlayfairDisplay-Italic.woff2', weight: '400', style: 'italic' },
    { path: '../fonts/PlayfairDisplay-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../fonts/PlayfairDisplay-BoldItalic.woff2', weight: '700', style: 'italic' },
    { path: '../fonts/PlayfairDisplay-Black.woff2', weight: '900', style: 'normal' },
    { path: '../fonts/PlayfairDisplay-BlackItalic.woff2', weight: '900', style: 'italic' },
  ],
  variable: '--font-heading',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Chrism',
  description: 'A Catholic companion for real life.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${headingFont.variable}`}>
      <body>
        <PendingSubmitEnhancer />
        <CleanQueryMessageParams />
        {children}
        <Analytics />
      </body>
    </html>
  )
}
