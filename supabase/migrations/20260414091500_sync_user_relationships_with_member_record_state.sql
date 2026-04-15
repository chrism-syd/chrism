begin;

create or replace function public.sync_user_unit_relationship_status_from_member_record()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.lifecycle_state is not distinct from new.lifecycle_state then
    return new;
  end if;

  if new.lifecycle_state = 'archived'::member_record_lifecycle_state then
    update public.user_unit_relationships
    set status = 'inactive'::relationship_status,
        updated_at = now()
    where member_record_id = new.id
      and local_unit_id = new.local_unit_id
      and status = 'active'::relationship_status;
  elsif old.lifecycle_state = 'archived'::member_record_lifecycle_state
     and new.lifecycle_state <> 'archived'::member_record_lifecycle_state then
    update public.user_unit_relationships
    set status = 'active'::relationship_status,
        updated_at = now()
    where member_record_id = new.id
      and local_unit_id = new.local_unit_id
      and relationship_kind = 'linked_member_record'::relationship_kind
      and status = 'inactive'::relationship_status;
  end if;

  return new;
end;
$function$;

drop trigger if exists member_records_sync_user_relationship_status on public.member_records;
create trigger member_records_sync_user_relationship_status
after update of lifecycle_state on public.member_records
for each row
execute function public.sync_user_unit_relationship_status_from_member_record();

commit;
