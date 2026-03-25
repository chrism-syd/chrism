import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

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
  description: 'Spiritual guidance and organization support for Chrism communities.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${headingFont.variable}`}>{children}</body>
    </html>
  )
}
