create table public.people_intake_reviews (
 id uuid primary key default gen_random_uuid(),
 local_unit_id uuid not null references public.local_units(id),
 source_kind text not null check(source_kind in ('roster','manual','existing')),
 dedupe_key text not null, encrypted_input text not null,
 candidate_ids uuid[] not null default '{}',
 status text not null default 'pending' check(status in ('pending','resolved')),
 decision text, resolved_person_id uuid references public.people(id),
 created_at timestamptz not null default now(), reviewed_at timestamptz,
 created_by_auth_user_id uuid not null references auth.users(id),
 reviewed_by_auth_user_id uuid references auth.users(id),
 unique(local_unit_id,dedupe_key)
);
alter table public.people_intake_reviews enable row level security;
revoke all on public.people_intake_reviews from public, anon, authenticated;
grant all on public.people_intake_reviews to service_role;
create policy people_intake_reviews_service on public.people_intake_reviews for all to service_role using (true) with check (true);
create index people_intake_reviews_pending on public.people_intake_reviews(local_unit_id,created_at) where status='pending';

-- Only the authenticated server action may resolve a review. Its scope and actor
-- are checked before this service-role-only transaction is called.
create function public.resolve_people_intake_review(
 p_review_id uuid,p_local_unit_id uuid,p_actor_user_id uuid,p_decision text,
 p_target_person_id uuid default null,p_rpc_args jsonb default '{}',p_person_patch jsonb default '{}'
) returns jsonb language plpgsql security invoker set search_path=public,app,pg_temp as $fn$
declare
 v_review public.people_intake_reviews%rowtype;
 v_before public.people%rowtype;
 v_after public.people%rowtype;
 v_result jsonb; v_person_id uuid; v_council_id uuid; v_org_id uuid;
begin
 if auth.role() is distinct from 'service_role' or p_actor_user_id is null then raise exception 'Not authorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_local_unit_id::text,4819));
 select * into v_review from public.people_intake_reviews where id=p_review_id and local_unit_id=p_local_unit_id for update;
 if not found then raise exception 'Review not found in the active organization'; end if;
 if v_review.status='resolved' then return jsonb_build_object('person_id',v_review.resolved_person_id,'already_resolved',true); end if;
 select lu.legacy_council_id,coalesce(lu.legacy_organization_id,c.organization_id) into v_council_id,v_org_id from public.local_units lu left join public.councils c on c.id=lu.legacy_council_id where lu.id=p_local_unit_id;
 if p_decision not in ('skip','keep_separate','archive_existing','update','create') then raise exception 'Invalid decision'; end if;
 if v_review.source_kind='existing' and p_decision not in ('keep_separate','archive_existing') then raise exception 'Choose whether to keep both records or archive a copy'; end if;
 if v_review.source_kind<>'existing' and p_decision not in ('skip','update','create') then raise exception 'Invalid incoming record decision'; end if;
 if p_decision in ('update','archive_existing') then
   select * into v_before from public.people where id=p_target_person_id and archived_at is null and merged_into_person_id is null for update;
   if not found or not (
     exists(select 1 from public.local_unit_people where local_unit_id=p_local_unit_id and person_id=p_target_person_id and ended_at is null)
     or (not exists(select 1 from public.local_unit_people where local_unit_id=p_local_unit_id and person_id=p_target_person_id)
       and exists(select 1 from public.member_records where local_unit_id=p_local_unit_id and legacy_people_id=p_target_person_id and archived_at is null))
   ) then raise exception 'Person is not active in this organization'; end if;
 end if;
 if p_decision='archive_existing' then
   if not p_target_person_id=any(v_review.candidate_ids) then raise exception 'Person is not part of this duplicate review'; end if;
   perform public.archive_local_unit_member_record(p_local_unit_id,p_target_person_id,p_actor_user_id,'Duplicate review: archived by administrator');
   v_person_id:=p_target_person_id;
 elsif p_decision in ('create','update') then
   if v_review.source_kind='roster' and ((p_decision='create' and coalesce(p_person_patch->>'primary_relationship_code','member')='member') or (p_decision='update' and v_before.primary_relationship_code='member')) then
     if (p_rpc_args->>'p_organization_id')::uuid is distinct from v_org_id then raise exception 'Organization scope mismatch'; end if;
     if p_decision='create' and nullif(p_rpc_args->>'p_member_number','') is not null and (
       exists(select 1 from public.member_records where local_unit_id=p_local_unit_id and
         regexp_replace(member_number,'^0+','')=regexp_replace(p_rpc_args->>'p_member_number','^0+',''))
       or exists(select 1 from public.organization_memberships where organization_id=v_org_id and
         regexp_replace(membership_number,'^0+','')=regexp_replace(p_rpc_args->>'p_member_number','^0+',''))
     ) then raise exception 'That member number already exists. Update its owner, or leave the number blank for a separate person.'; end if;
     if p_decision='update' and nullif(p_rpc_args->>'p_member_number','') is not null and (
       exists(select 1 from public.member_records where local_unit_id=p_local_unit_id and legacy_people_id is distinct from p_target_person_id and
         regexp_replace(member_number,'^0+','')=regexp_replace(p_rpc_args->>'p_member_number','^0+',''))
       or exists(select 1 from public.organization_memberships where organization_id=v_org_id and person_id<>p_target_person_id and
         regexp_replace(membership_number,'^0+','')=regexp_replace(p_rpc_args->>'p_member_number','^0+',''))
     ) then raise exception 'That member number belongs to another person. Review its owner before applying this update.'; end if;
     v_result := public.apply_supreme_import_row(
       p_local_unit_id => p_local_unit_id,
       p_organization_id => (p_rpc_args->>'p_organization_id')::uuid,
       p_auth_user_id => p_actor_user_id,
       p_import_mode => case when p_decision='update' then 'update_existing' else 'create_new' end,
       p_existing_person_id => p_target_person_id,
       p_council_number => (p_rpc_args->>'p_council_number')::text,
       p_title => (p_rpc_args->>'p_title')::text,
       p_first_name => (p_rpc_args->>'p_first_name')::text,
       p_middle_name => (p_rpc_args->>'p_middle_name')::text,
       p_last_name => (p_rpc_args->>'p_last_name')::text,
       p_suffix => (p_rpc_args->>'p_suffix')::text,
       p_email => (p_rpc_args->>'p_email')::text,
       p_email_hash => (p_rpc_args->>'p_email_hash')::text,
       p_cell_phone => (p_rpc_args->>'p_cell_phone')::text,
       p_cell_phone_hash => (p_rpc_args->>'p_cell_phone_hash')::text,
       p_address_line_1 => (p_rpc_args->>'p_address_line_1')::text,
       p_address_line_1_hash => (p_rpc_args->>'p_address_line_1_hash')::text,
       p_city => (p_rpc_args->>'p_city')::text,
       p_city_hash => (p_rpc_args->>'p_city_hash')::text,
       p_state_province => (p_rpc_args->>'p_state_province')::text,
       p_state_province_hash => (p_rpc_args->>'p_state_province_hash')::text,
       p_postal_code => (p_rpc_args->>'p_postal_code')::text,
       p_postal_code_hash => (p_rpc_args->>'p_postal_code_hash')::text,
       p_birth_date => (p_rpc_args->>'p_birth_date')::date,
       p_birth_date_hash => (p_rpc_args->>'p_birth_date_hash')::text,
       p_pii_key_version => (p_rpc_args->>'p_pii_key_version')::text,
       p_council_activity_level_code => (p_rpc_args->>'p_council_activity_level_code')::text,
       p_member_number => (p_rpc_args->>'p_member_number')::text,
       p_first_degree_date => (p_rpc_args->>'p_first_degree_date')::date,
       p_second_degree_date => (p_rpc_args->>'p_second_degree_date')::date,
       p_third_degree_date => (p_rpc_args->>'p_third_degree_date')::date,
       p_years_in_service => (p_rpc_args->>'p_years_in_service')::integer,
       p_member_type => (p_rpc_args->>'p_member_type')::text,
       p_member_class => (p_rpc_args->>'p_member_class')::text,
       p_assembly_number => (p_rpc_args->>'p_assembly_number')::text);
     v_person_id:=(v_result->>'person_id')::uuid;
     if p_decision='update' then
       -- A roster update is not approval to convert a prospect or volunteer.
       update public.people set primary_relationship_code=v_before.primary_relationship_code,
         is_provisional_member=v_before.is_provisional_member,prospect_status_code=v_before.prospect_status_code,
         volunteer_context_code=v_before.volunteer_context_code where id=v_person_id;
     end if;
     -- The roster RPC does not accept home/other phones; preserve their selected values too.
     select * into v_after from public.people where id=v_person_id;
     v_after:=jsonb_populate_record(v_after,p_person_patch);
     update public.people set home_phone=v_after.home_phone,home_phone_hash=v_after.home_phone_hash,
       other_phone=v_after.other_phone,other_phone_hash=v_after.other_phone_hash where id=v_person_id;
   else
     v_after:=jsonb_populate_record(case when p_decision='update' then v_before else null::public.people end,p_person_patch);
     if p_decision='create' then
       insert into public.people(council_id,first_name,middle_name,last_name,email,email_hash,cell_phone,cell_phone_hash,
         home_phone,home_phone_hash,other_phone,other_phone_hash,address_line_1,address_line_1_hash,address_line_2,address_line_2_hash,
         city,city_hash,state_province,state_province_hash,postal_code,postal_code_hash,pii_key_version,
         primary_relationship_code,created_source_code,is_provisional_member,prospect_status_code,volunteer_context_code,
         council_activity_level_code,council_activity_context_code,council_reengagement_status_code,created_by_auth_user_id,updated_by_auth_user_id)
       values(v_council_id,v_after.first_name,v_after.middle_name,v_after.last_name,v_after.email,v_after.email_hash,v_after.cell_phone,v_after.cell_phone_hash,
         v_after.home_phone,v_after.home_phone_hash,v_after.other_phone,v_after.other_phone_hash,v_after.address_line_1,v_after.address_line_1_hash,v_after.address_line_2,v_after.address_line_2_hash,
         v_after.city,v_after.city_hash,v_after.state_province,v_after.state_province_hash,v_after.postal_code,v_after.postal_code_hash,v_after.pii_key_version,
         v_after.primary_relationship_code,v_after.created_source_code,v_after.is_provisional_member,v_after.prospect_status_code,v_after.volunteer_context_code,
         v_after.council_activity_level_code,v_after.council_activity_context_code,v_after.council_reengagement_status_code,p_actor_user_id,p_actor_user_id)
       returning id into v_person_id;
       perform public.ensure_member_record_for_person_local_unit(p_local_unit_id,v_person_id);
     else
       update public.people set title=v_after.title,first_name=v_after.first_name,middle_name=v_after.middle_name,last_name=v_after.last_name,suffix=v_after.suffix,
         birth_date=v_after.birth_date,birth_date_hash=v_after.birth_date_hash,
         email=v_after.email,email_hash=v_after.email_hash,cell_phone=v_after.cell_phone,cell_phone_hash=v_after.cell_phone_hash,
         home_phone=v_after.home_phone,home_phone_hash=v_after.home_phone_hash,other_phone=v_after.other_phone,other_phone_hash=v_after.other_phone_hash,
         address_line_1=v_after.address_line_1,address_line_1_hash=v_after.address_line_1_hash,address_line_2=v_after.address_line_2,address_line_2_hash=v_after.address_line_2_hash,
         city=v_after.city,city_hash=v_after.city_hash,state_province=v_after.state_province,state_province_hash=v_after.state_province_hash,
         postal_code=v_after.postal_code,postal_code_hash=v_after.postal_code_hash,pii_key_version=v_after.pii_key_version,
         updated_by_auth_user_id=p_actor_user_id where id=p_target_person_id;
       v_person_id:=p_target_person_id;
     end if;
   end if;
 end if;
 if v_person_id is not null and p_decision in ('create','update') and nullif(p_rpc_args->>'_source_note','') is not null then
   insert into public.person_notes(council_id,person_id,note_type_code,body,created_by_auth_user_id,updated_by_auth_user_id)
   values(v_council_id,v_person_id,'admin','Original uploaded notes (historical source):' || E'\n' || (p_rpc_args->>'_source_note'),p_actor_user_id,p_actor_user_id);
 end if;
 update public.people_intake_reviews set status='resolved',decision=p_decision,resolved_person_id=v_person_id,
   reviewed_at=now(),reviewed_by_auth_user_id=p_actor_user_id where id=p_review_id;
 perform app.write_audit_log(v_council_id,'people_intake_reviews',p_review_id,'resolve_people_intake_review',
   jsonb_build_object('decision',p_decision,'person_id',v_person_id,'actor_user_id',p_actor_user_id,'selected_incoming_fields',p_rpc_args->'_selected_fields'));
 return jsonb_build_object('person_id',v_person_id,'decision',p_decision);
end;
$fn$;
revoke all on function public.resolve_people_intake_review(uuid,uuid,uuid,text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.resolve_people_intake_review(uuid,uuid,uuid,text,uuid,jsonb,jsonb) to service_role;
