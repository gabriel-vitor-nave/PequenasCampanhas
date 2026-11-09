begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(10);
select ok(not has_table_privilege('anon','public.campaigns','select'), 'Anonymous users cannot read campaigns');
select ok(not has_function_privilege('anon','public.create_campaign(text,text)','execute'), 'Anonymous users cannot create campaigns');
select ok(not has_column_privilege('authenticated','public.campaigns','owner_id','update'), 'Ownership is not client-writable');
select ok(not has_column_privilege('authenticated','public.campaign_members','role','update'), 'Roles are not client-writable');

insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
  ('20000000-0000-4000-8000-000000000001','sql-gm@example.com',now(),'{"display_name":"Mestre SQL"}'),
  ('20000000-0000-4000-8000-000000000002','sql-other@example.com',now(),'{"display_name":"Outro SQL"}');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.create_campaign('Campanha SQL','Teste de isolamento');
select is((select count(*)::int from public.campaigns),1,'Creator can read campaign');
select is((select role from public.campaign_members limit 1),'gm','Creator is master');
select is((select count(*)::int from public.activity_logs),1,'Creation records activity');

reset role;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((select count(*)::int from public.campaigns),0,'Outsider cannot read campaign');
select is((select count(*)::int from public.activity_logs),0,'Outsider cannot read activity');
select is((select count(*)::int from public.profiles),1,'Outsider can read only own profile');
select * from finish();
rollback;
