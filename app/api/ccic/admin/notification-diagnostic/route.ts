import { NextResponse } from 'next/server'
import { getCcicOrderAdminSession } from '@/lib/christmas-cards/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const session = await getCcicOrderAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  const configuredRecipients = [...new Set((process.env.CCIC_ORDER_NOTIFICATION_EMAIL || '')
    .split(',')
    .map((address) => address.trim().toLowerCase())
    .filter((address) => /^\S+@\S+\.\S+$/.test(address)))]

  return NextResponse.json({
    notificationVariablePresent: Boolean(process.env.CCIC_ORDER_NOTIFICATION_EMAIL?.trim()),
    validRecipientCount: configuredRecipients.length,
    expectedRecipientCount: 2,
    ready: configuredRecipients.length === 2,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
