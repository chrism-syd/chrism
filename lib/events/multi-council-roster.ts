import type { createClient } from '@/lib/supabase/server';

export type MultiCouncilInviteRow = {
  id: string;
  event_id: string;
  is_host: boolean;
  invited_council_name: string;
  invited_council_number: string | null;
  invite_email: string | null;
  invite_contact_name: string | null;
  rsvp_link_token?: string;
  sort_order?: number;
};

export type MultiCouncilRollupRow = {
  event_id: string;
  event_invited_council_id: string;
  invited_council_name: string;
  invited_council_number: string | null;
  invite_email?: string | null;
  is_host?: boolean;
  has_responded: boolean;
  volunteer_count: number;
  last_responded_at?: string | null;
  event_council_rsvp_id: string | null;
};

export type MultiCouncilRsvpRow = {
  id: string;
  event_id: string;
  event_invited_council_id: string;
  responding_contact_name: string | null;
  responding_contact_email: string | null;
  responding_contact_phone: string | null;
  response_notes: string | null;
  last_responded_at: string;
};

export type MultiCouncilVolunteerRow = {
  id: string;
  event_council_rsvp_id: string;
  volunteer_name: string;
  volunteer_email: string | null;
  volunteer_phone: string | null;
  volunteer_notes: string | null;
  sort_order: number;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => !!value)));
}

export async function loadMultiCouncilRoster(
  supabase: SupabaseServerClient,
  eventId: string
): Promise<{
  invites: MultiCouncilInviteRow[];
  rollups: MultiCouncilRollupRow[];
  rsvps: MultiCouncilRsvpRow[];
  volunteers: MultiCouncilVolunteerRow[];
}> {
  const [
    { data: invitesData, error: invitesError },
    { data: rollupsData, error: rollupsError },
    { data: rsvpsData, error: rsvpsError },
  ] = await Promise.all([
    supabase
      .from('event_invited_councils')
      .select(
        'id, event_id, is_host, invited_council_name, invited_council_number, invite_email, invite_contact_name, rsvp_link_token, sort_order'
      )
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
      .returns<MultiCouncilInviteRow[]>(),
    supabase
      .from('event_council_rsvp_rollups')
      .select(
        'event_id, event_invited_council_id, invited_council_name, invited_council_number, invite_email, is_host, has_responded, volunteer_count, last_responded_at, event_council_rsvp_id'
      )
      .eq('event_id', eventId)
      .returns<MultiCouncilRollupRow[]>(),
    supabase
      .from('event_council_rsvps')
      .select(
        'id, event_id, event_invited_council_id, responding_contact_name, responding_contact_email, responding_contact_phone, response_notes, last_responded_at'
      )
      .eq('event_id', eventId)
      .returns<MultiCouncilRsvpRow[]>(),
  ]);

  if (invitesError || rollupsError || rsvpsError) {
    throw new Error(
      invitesError?.message ??
        rollupsError?.message ??
        rsvpsError?.message ??
        'Could not load multi-council roster.'
    );
  }

  const invites = invitesData ?? [];
  const rollups = rollupsData ?? [];
  const rsvps = rsvpsData ?? [];
  const rsvpIds = uniqueIds([
    ...rsvps.map((row) => row.id),
    ...rollups.map((row) => row.event_council_rsvp_id),
  ]);

  let volunteers: MultiCouncilVolunteerRow[] = [];

  if (rsvpIds.length > 0) {
    const { data: volunteersData, error: volunteersError } = await supabase
      .from('event_rsvp_volunteers')
      .select(
        'id, event_council_rsvp_id, volunteer_name, volunteer_email, volunteer_phone, volunteer_notes, sort_order'
      )
      .in('event_council_rsvp_id', rsvpIds)
      .order('sort_order', { ascending: true })
      .returns<MultiCouncilVolunteerRow[]>();

    if (volunteersError) {
      throw new Error(volunteersError.message);
    }

    volunteers = volunteersData ?? [];
  }

  return {
    invites,
    rollups,
    rsvps,
    volunteers,
  };
}
