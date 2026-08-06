import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Registration closed | Chrism',
}

export default function RegisterPage() {
  redirect('/login?registration=closed')
}
