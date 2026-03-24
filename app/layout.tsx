import type { Metadata } from 'next'
import { Atkinson_Hyperlegible, Playfair_Display } from 'next/font/google'
import './globals.css'

const bodyFont = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-body',
})

const headingFont = Playfair_Display({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-heading',
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
