-- Transactional integration checks; all fixture records and audit events roll back.
begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $test$
declare
 unit_id uuid; council_id uuid; org_id uuid; actor uuid; target uuid; other_unit uuid;
 review_id uuid; new_id uuid; outcome jsonb; args jsonb; counts integer; number text;
begin
 select lu.id,lu.legacy_council_id,coalesce(lu.legacy_organization_id,c.organization_id) into unit_id,council_id,org_id
   from local_units lu join councils c on c.id=lu.legacy_council_id where c.council_number='7689';
 select id into actor from auth.users order by created_at limit 1;
 select id into other_unit from local_units where id<>unit_id limit 1;
 insert into people_intake_reviews(local_unit_id,source_kind,dedupe_key,encrypted_input,created_by_auth_user_id)
   values(unit_id,'manual',gen_random_uuid()::text,'test ciphertext',actor) returning id into review_id;
 outcome:=resolve_people_intake_review(review_id,unit_id,actor,'create',null,'{}',jsonb_build_object(
   'first_name','IntakeRegression','last_name','Prospect','email','review-test@example.invalid',
   'primary_relationship_code','prospect','created_source_code','scoped_manual_prospect','is_provisional_member',false,'prospect_status_code','new'));
 target:=(outcome->>'person_id')::uuid;
 if not exists(select 1 from people where id=target and primary_relationship_code='prospect') then raise exception 'Manual category lost'; end if;
 outcome:=resolve_people_intake_review(review_id,unit_id,actor,'create');
 if outcome->>'already_resolved'<>'true' then raise exception 'Repeated decision was not idempotent'; end if;
 if (select count(*) from people where first_name='IntakeRegression' and last_name='Prospect')<>1 then raise exception 'Repeated decision created a duplicate'; end if;
 -- Updating from a roster must never promote a prospect or volunteer to member.
 foreach number in array array['prospect','volunteer_only'] loop
   update people set primary_relationship_code=number,prospect_status_code=case when number='prospect' then 'new' end,
      volunteer_context_code=case when number='volunteer_only' then 'unknown' end where id=target;
   insert into people_intake_reviews(local_unit_id,source_kind,dedupe_key,encrypted_input,created_by_auth_user_id)
     values(unit_id,'roster',gen_random_uuid()::text,'test ciphertext',actor) returning id into review_id;
   outcome:=resolve_people_intake_review(review_id,unit_id,actor,'update',target,'{}','{"first_name":"IntakeRegression","last_name":"Prospect","email":"updated@example.invalid"}');
   if not exists(select 1 from people where id=target and primary_relationship_code=number and email='updated@example.invalid') then raise exception 'Roster update changed a non-member category'; end if;
 end loop;
 -- A brand-new roster member is created only by the explicit review decision.
 insert into people_intake_reviews(local_unit_id,source_kind,dedupe_key,encrypted_input,created_by_auth_user_id)
   values(unit_id,'roster',gen_random_uuid()::text,'test ciphertext',actor) returning id into review_id;
 number:='99'||left(replace(gen_random_uuid()::text,'-',''),18);
 args:=jsonb_build_object('p_organization_id',org_id,'p_council_number','7689','p_first_name','IntakeRegression',
   'p_last_name','Member','p_member_number',number,'p_email','member-test@example.invalid');
 outcome:=resolve_people_intake_review(review_id,unit_id,actor,'create',null,args);
 new_id:=(outcome->>'person_id')::uuid;
 if not exists(select 1 from people where id=new_id and primary_relationship_code='member') then raise exception 'Roster creation failed'; end if;
 if not exists(select 1 from local_unit_people where local_unit_id=unit_id and person_id=new_id and ended_at is null) then raise exception 'Roster creation did not establish scope'; end if;
 args:=args||jsonb_build_object('_expected_candidate_ids',jsonb_build_array(new_id));
 -- A separate-person decision cannot silently update the existing owner of a number.
 insert into people_intake_reviews(local_unit_id,source_kind,dedupe_key,encrypted_input,created_by_auth_user_id)
   values(unit_id,'roster',gen_random_uuid()::text,'test ciphertext',actor) returning id into review_id;
 begin
   perform resolve_people_intake_review(review_id,unit_id,actor,'create',null,args);
   raise exception 'Duplicate number was accepted';
 exception when others then
   if sqlerrm not like 'That member number already exists.%' then raise; end if;
 end;
 if not exists(select 1 from people_intake_reviews where id=review_id and status='pending') then raise exception 'Failed decision consumed review'; end if;
 -- A newly-appearing duplicate blocks a stale create decision and leaves its review pending.
 insert into people_intake_reviews(local_unit_id,source_kind,dedupe_key,encrypted_input,created_by_auth_user_id)
   values(unit_id,'manual',gen_random_uuid()::text,'test ciphertext',actor) returning id into review_id;
 begin
   perform resolve_people_intake_review(review_id,unit_id,actor,'create',null,'{}',jsonb_build_object('first_name','IntakeRegression','last_name','Member'));
   raise exception 'Stale create decision accepted';
 exception when others then
   if sqlerrm not like 'A matching person was added or changed.%' then raise; end if;
 end;
 -- Wrong-organization targets and reviews are rejected before mutation.
 begin
   perform resolve_people_intake_review(review_id,other_unit,actor,'skip');
   raise exception 'Cross-scope review accepted';
 exception when others then
   if sqlerrm<>'Review not found in the active organization' then raise; end if;
 end;
 -- Skip does not create a person and can safely be repeated.
 outcome:=resolve_people_intake_review(review_id,unit_id,actor,'skip');
 if not exists(select 1 from people_intake_reviews where id=review_id and decision='skip') then raise exception 'Skip not recorded'; end if;
 -- Archiving a duplicate copy uses the normal archive lifecycle; nothing is deleted or merged.
 insert into people_intake_reviews(local_unit_id,source_kind,dedupe_key,encrypted_input,candidate_ids,created_by_auth_user_id)
   values(unit_id,'existing',gen_random_uuid()::text,'test ciphertext',array[target,new_id],actor) returning id into review_id;
 perform resolve_people_intake_review(review_id,unit_id,actor,'archive_existing',target);
 if exists(select 1 from local_unit_people where person_id=target and local_unit_id=unit_id and ended_at is null) then raise exception 'Duplicate archive did not end assignment'; end if;
 if not exists(select 1 from people where id=target and primary_relationship_code='volunteer_only') then raise exception 'Duplicate archive lost profile or category'; end if;
 -- Uploaded non-members keep an explicitly selected non-member category.
 insert into people_intake_reviews(local_unit_id,source_kind,dedupe_key,encrypted_input,created_by_auth_user_id)
   values(unit_id,'roster',gen_random_uuid()::text,'test ciphertext',actor) returning id into review_id;
 outcome:=resolve_people_intake_review(review_id,unit_id,actor,'create',null,'{}',jsonb_build_object(
   'first_name','UploadedVolunteerRegression','last_name','NonMember','primary_relationship_code','volunteer_only',
   'created_source_code','supreme_import','is_provisional_member',false,'volunteer_context_code','unknown'));
 if not exists(select 1 from people where id=(outcome->>'person_id')::uuid and primary_relationship_code='volunteer_only') then raise exception 'Uploaded volunteer became a member'; end if;
 if exists(select 1 from organization_memberships where person_id=(outcome->>'person_id')::uuid) then raise exception 'Uploaded non-member acquired official membership'; end if;
 -- Source notes are preserved once, and a stale target version cannot overwrite newer data.
 insert into people_intake_reviews(local_unit_id,source_kind,dedupe_key,encrypted_input,created_by_auth_user_id)
   values(unit_id,'manual',gen_random_uuid()::text,'test ciphertext',actor) returning id into review_id;
 begin
   perform resolve_people_intake_review(review_id,unit_id,actor,'update',new_id,'{"_expected_updated_at":"2000-01-01T00:00:00Z"}','{"first_name":"Wrong"}');
   raise exception 'Stale update accepted';
 exception when others then
   if sqlerrm not like 'This person changed.%' then raise; end if;
 end;
 outcome:=resolve_people_intake_review(review_id,unit_id,actor,'update',new_id,jsonb_build_object('_source_note',E'Member number: TestOnly\nKeep MiXeD Case'),'{}');
 perform resolve_people_intake_review(review_id,unit_id,actor,'update',new_id,jsonb_build_object('_source_note','Duplicate note'),'{}');
 if (select count(*) from person_notes where person_id=new_id and body like 'Original uploaded notes%')<>1 then raise exception 'Source notes were lost or duplicated'; end if;
 if not exists(select 1 from person_notes where person_id=new_id and body like '%Keep MiXeD Case') then raise exception 'Source notes changed case'; end if;
 if has_table_privilege('anon','public.people_intake_reviews','select') or has_table_privilege('authenticated','public.people_intake_reviews','select') then raise exception 'Review snapshots exposed to public clients'; end if;
 perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 begin
   perform resolve_people_intake_review(review_id,unit_id,actor,'skip');
   raise exception 'Non-service caller accepted';
 exception when others then
   if sqlerrm<>'Not authorized' then raise; end if;
 end;
end;
$test$;
rollback;
select 'People intake review integration checks passed; test records rolled back' as result;
