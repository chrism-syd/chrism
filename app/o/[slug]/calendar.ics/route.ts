import { NextResponse } from 'next/server'
import { escapeIcsText, getEventKindLabel, toIcsUtc } from '@/lib/events/meetings'
import { buildCouncilPublicOrgSlug, extractTrailingCouncilNumber } from '@/lib/public-org-slugs'
import { createAdminClient } from '@/lib/supabase/admin'

type RouteProps = {
  params: Promise<{ slug: string }>
}

type MeetingRow = {
  id: string
  title: string
  description: string | null
  location_name: string | null
  location_address: string | null
  starts_at: string
  ends_at: string | null
  event_kind_code: 'standard' | 'general_meeting' | 'executive_meeting'
  updated_at: string
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(_request: Request, { params }: RouteProps) {
  const { slug } = await params
  const councilNumber = extractTrailingCouncilNumber(slug)

  if (!councilNumber) {
    return new NextResponse('Calendar not found', { status: 404 })
  }

  const supabase = createAdminClient()

  const { data: council } = await supabase
    .from('councils')
    .select('id, name, council_number')
    .eq('council_number', councilNumber)
    .maybeSingle()

  if (!council?.id) {
    return new NextResponse('Calendar not found', { status: 404 })
  }

  const canonicalSlug = buildCouncilPublicOrgSlug({ name: council.name, councilNumber: council.council_number })
  if (slug !== canonicalSlug) {
    return NextResponse.redirect(new URL(`/o/${encodeURIComponent(canonicalSlug)}/calendar.ics`, _request.url), 308)
  }

  const { data: meetings } = await supabase
    .from('events')
    .select('id, title, description, location_name, location_address, starts_at, ends_at, event_kind_code, updated_at')
    .eq('council_id', council.id)
    .in('event_kind_code', ['standard', 'general_meeting', 'executive_meeting'])
    .gte('starts_at', new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString())
    .order('starts_at', { ascending: true })
    .returns<MeetingRow[]>()

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const publicPageUrl = `${baseUrl.replace(/\/+$/, '')}/o/${encodeURIComponent(canonicalSlug)}/events`
  const nowStamp = toIcsUtc(new Date().toISOString())
  const events = (meetings ?? []).map((meeting) => {
    const endsAt = meeting.ends_at || meeting.starts_at
    const description = [
      getEventKindLabel(meeting.event_kind_code),
      meeting.description,
      `Public events page: ${publicPageUrl}`,
    ]
      .filter(Boolean)
      .join('\n\n')

    const location = [meeting.location_name, meeting.location_address].filter(Boolean).join(', ')

    return [
      'BEGIN:VEVENT',
      `UID:event-${meeting.id}@chrism`,
      `DTSTAMP:${toIcsUtc(meeting.updated_at || new Date().toISOString())}`,
      `DTSTART:${toIcsUtc(meeting.starts_at)}`,
      `DTEND:${toIcsUtc(endsAt)}`,
      `SUMMARY:${escapeIcsText(meeting.title)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `LOCATION:${escapeIcsText(location)}`,
      `URL:${escapeIcsText(publicPageUrl)}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
    ].join('\r\n')
  })

  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chrism//Public Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(`${council.name || 'Local organization'} Events`)}`,
    `X-WR-CALDESC:${escapeIcsText(`Public events for ${council.name || `Council ${council.council_number ?? councilNumber}`}`)}`,
    'X-PUBLISHED-TTL:PT6H',
    ...events,
    'END:VCALENDAR',
    '',
  ].join('\r\n')

  return new NextResponse(calendar, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${canonicalSlug}-events.ics"`,
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
      'X-Generated-At': nowStamp,
    },
  })
}
