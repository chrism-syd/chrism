/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';

export type PublicInviteContext = {
  invite: {
    id: string;
    event_id: string;
    invited_council_name: string;
    invited_council_number: string | null;
    invite_email: string | null;
    invite_contact_name: string | null;
    is_host: boolean;
    rsvp_link_token: string;
  };
  event: {
    id: string;
    host_council_id: string;
    title: string;
    description: string | null;
    location_name: string | null;
    location_address: string | null;
    starts_at: string;
    ends_at: string;
    requires_rsvp: boolean;
    rsvp_deadline_at: string | null;
    status_code: string;
    scope_code: 'home_council_only' | 'multi_council';
  };
};

export async function loadPublicInviteContext(
  supabase: SupabaseClient<any, 'public', any>,
  token: string
): Promise<PublicInviteContext | null> {
  const { data: inviteData, error: inviteError } = await supabase
    .from('event_invited_councils')
    .select(
      'id, event_id, invited_council_name, invited_council_number, invite_email, invite_contact_name, is_host, rsvp_link_token'
    )
    .eq('rsvp_link_token', token)
    .maybeSingle();

  const invite = inviteData as PublicInviteContext['invite'] | null;

  if (inviteError || !invite) {
    return null;
  }

  const { data: eventData, error: eventError } = await supabase
    .from('events')
    .select(
      'id, council_id, title, description, location_name, location_address, starts_at, ends_at, requires_rsvp, rsvp_deadline_at, status_code, scope_code'
    )
    .eq('id', invite.event_id)
    .maybeSingle();

  const rawEvent = eventData as ({ council_id: string } & Omit<PublicInviteContext['event'], 'host_council_id'>) | null;

  if (eventError || !rawEvent) {
    return null;
  }

  const event: PublicInviteContext['event'] = {
    id: rawEvent.id,
    host_council_id: rawEvent.council_id,
    title: rawEvent.title,
    description: rawEvent.description,
    location_name: rawEvent.location_name,
    location_address: rawEvent.location_address,
    starts_at: rawEvent.starts_at,
    ends_at: rawEvent.ends_at,
    requires_rsvp: rawEvent.requires_rsvp,
    rsvp_deadline_at: rawEvent.rsvp_deadline_at,
    status_code: rawEvent.status_code,
    scope_code: rawEvent.scope_code,
  };

  return { invite, event };
}
