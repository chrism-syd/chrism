'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentActingCouncilContext } from '@/lib/auth/acting-context'
import { listValidDirectoryPersonIdsForLocalUnit } from '@/lib/custom-lists'

function normalizeString(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function nullableString(value: FormDataEntryValue | null) {
  const normalized = normalizeString(value)
  return normalized.length > 0 ? normalized : null
}

function parseHours(value: FormDataEntryValue | null) {
  const normalized = normalizeString(value)
  const hours = Number(normalized)

  if (!Number.isFinite(hours)) {
    throw new Error('Hours must be a number.')
  }

  if (hours === 0) {
    throw new Error('Hours must not be zero.')
  }

  if (hours < -999.99 || hours > 999.99) {
    throw new Error('Hours must be between -999.99 and 999.99.')
  }

  return Math.round(hours * 100) / 100
}

function parseCreditedOn(value: FormDataEntryValue | null) {
  const normalized = normalizeString(value)

  if (!normalized) {
    return new Date().toISOString().slice(0, 10)
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error('Credited date must be a valid date.')
  }

  return normalized
}

async function assertScopedPerson(args: {
  supabase: Awaited<ReturnType<typeof getCurrentActingCouncilContext>>['admin']
  localUnitId: string
  personId: string
}) {
  const { supabase, localUnitId, personId } = args

  const validPersonIds = await listValidDirectoryPersonIdsForLocalUnit({
    admin: supabase,
    localUnitId,
    personIds: [personId],
  })

  if (!validPersonIds.includes(personId)) {
    throw new Error('That person is not in this local organization directory.')
  }
}

export async function addVolunteerHourAdjustment(formData: FormData) {
  const { admin: supabase, permissions, localUnitId } = await getCurrentActingCouncilContext({
    redirectTo: '/events/volunteer-hours',
    areaCode: 'events',
    minimumAccessLevel: 'manage',
  })

  if (!localUnitId) {
    throw new Error('Could not load your local organization context.')
  }

  const personId = normalizeString(formData.get('person_id'))
  const eventId = nullableString(formData.get('event_id'))
  const hoursDelta = parseHours(formData.get('hours_delta'))
  const creditedOn = parseCreditedOn(formData.get('credited_on'))
  const note = nullableString(formData.get('note'))

  if (!personId) {
    throw new Error('Person is required.')
  }

  await assertScopedPerson({ supabase, localUnitId, personId })

  if (eventId) {
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id')
      .eq('id', eventId)
      .eq('local_unit_id', localUnitId)
      .maybeSingle<{ id: string }>()

    if (eventError) {
      throw new Error(`Could not verify event scope. ${eventError.message}`)
    }

    if (!event?.id) {
      throw new Error('That event is not in this local organization.')
    }
  }

  const { error } = await supabase.from('local_unit_volunteer_hour_adjustments').insert({
    local_unit_id: localUnitId,
    person_id: personId,
    event_id: eventId,
    hours_delta: hoursDelta,
    credited_on: creditedOn,
    note,
    created_by_user_id: permissions.appUser?.id ?? null,
  })

  if (error) {
    throw new Error(`Could not save volunteer hour adjustment. ${error.message}`)
  }

  revalidatePath('/events/volunteer-hours')
  revalidatePath(`/people/${personId}`)
  redirect('/events/volunteer-hours')
}

export async function voidVolunteerHourAdjustment(formData: FormData) {
  const { admin: supabase, permissions, localUnitId } = await getCurrentActingCouncilContext({
    redirectTo: '/events/volunteer-hours',
    areaCode: 'events',
    minimumAccessLevel: 'manage',
  })

  if (!localUnitId) {
    throw new Error('Could not load your local organization context.')
  }

  const adjustmentId = normalizeString(formData.get('adjustment_id'))
  const personId = normalizeString(formData.get('person_id'))
  const voidReason = nullableString(formData.get('void_reason')) ?? 'Voided from volunteer hours audit page.'

  if (!adjustmentId || !personId) {
    throw new Error('Adjustment and person are required.')
  }

  await assertScopedPerson({ supabase, localUnitId, personId })

  const { error } = await supabase
    .from('local_unit_volunteer_hour_adjustments')
    .update({
      voided_at: new Date().toISOString(),
      voided_by_user_id: permissions.appUser?.id ?? null,
      void_reason: voidReason,
    })
    .eq('id', adjustmentId)
    .eq('local_unit_id', localUnitId)
    .eq('person_id', personId)
    .is('voided_at', null)

  if (error) {
    throw new Error(`Could not void volunteer hour adjustment. ${error.message}`)
  }

  revalidatePath('/events/volunteer-hours')
  revalidatePath(`/people/${personId}`)
  redirect('/events/volunteer-hours')
}
