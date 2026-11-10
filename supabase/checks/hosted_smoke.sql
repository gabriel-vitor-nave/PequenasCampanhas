-- Run against the hosted project through an authorized SQL connection.
-- All fixture users and campaigns are rolled back. No passwords or emails are sent.
begin;
select set_config('pc.gm',gen_random_uuid()::text,true);
select set_config('pc.player',gen_random_uuid()::text,true);
select set_config('pc.outsider',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
select current_setting('pc.gm')::uuid,'pc-'||current_setting('pc.gm')||'@example.invalid',now(),'{"display_name":"Mestre de teste"}'::jsonb
union all select current_setting('pc.player')::uuid,'pc-'||current_setting('pc.player')||'@example.invalid',now(),'{"display_name":"Jogador de teste"}'::jsonb
union all select current_setting('pc.outsider')::uuid,'pc-'||current_setting('pc.outsider')||'@example.invalid',now(),'{"display_name":"Visitante de teste"}'::jsonb;
update public.profiles set username='pc_'||left(replace(id::text,'-',''),20)
where id in(current_setting('pc.gm')::uuid,current_setting('pc.player')::uuid,current_setting('pc.outsider')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('pc.gm'),true);
select set_config('pc.campaign',public.create_campaign('Verificação automática','Transação revertida ao concluir')::text,true);
select set_config('pc.invite',public.invite_player_by_username(current_setting('pc.campaign')::uuid,'pc_'||left(replace(current_setting('pc.player'),'-',''),20))::text,true);
do $$ begin
  if (select count(*) from public.campaign_members where campaign_id=current_setting('pc.campaign')::uuid and role='gm')<>1 then raise exception 'SMOKE: master membership'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('pc.outsider'),true);
do $$ begin
  if exists(select 1 from public.campaigns where id=current_setting('pc.campaign')::uuid) then raise exception 'SMOKE: outsider campaign leak'; end if;
  if exists(select 1 from public.campaign_roster(current_setting('pc.campaign')::uuid)) then raise exception 'SMOKE: outsider roster leak'; end if;
  if exists(select 1 from public.my_invitations()) then raise exception 'SMOKE: outsider invitation leak'; end if;
  begin
    perform public.respond_to_invite(current_setting('pc.invite')::uuid,true);
    raise exception 'SMOKE: wrong recipient accepted';
  exception when raise_exception then if sqlerrm<>'PC_FORBIDDEN' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('pc.player'),true);
do $$ begin
  if (select count(*) from public.my_invitations())<>1 then raise exception 'SMOKE: own invitation missing'; end if;
  if exists(select 1 from public.campaigns where id=current_setting('pc.campaign')::uuid) then raise exception 'SMOKE: campaign visible before acceptance'; end if;
end $$;
select public.respond_to_invite(current_setting('pc.invite')::uuid,true);
do $$ declare changed integer; begin
  if not exists(select 1 from public.campaigns where id=current_setting('pc.campaign')::uuid) then raise exception 'SMOKE: accepted campaign missing'; end if;
  if (select count(*) from public.campaign_roster(current_setting('pc.campaign')::uuid))<>2 then raise exception 'SMOKE: shared roster'; end if;
  update public.campaigns set name='Unauthorized change' where id=current_setting('pc.campaign')::uuid;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'SMOKE: player edited campaign'; end if;
  begin
    update public.campaign_members set role='gm' where campaign_id=current_setting('pc.campaign')::uuid and user_id=current_setting('pc.player')::uuid;
    raise exception 'SMOKE: player escalated role';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.respond_to_invite(current_setting('pc.invite')::uuid,true);
    raise exception 'SMOKE: invitation replayed';
  exception when raise_exception then if sqlerrm<>'PC_INVITE_EXPIRED' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('pc.gm'),true);
select public.update_member_permissions(current_setting('pc.campaign')::uuid,current_setting('pc.player')::uuid,false,false);
do $$ begin
  if (select can_draw from public.campaign_members where campaign_id=current_setting('pc.campaign')::uuid and user_id=current_setting('pc.player')::uuid) then raise exception 'SMOKE: permissions not saved'; end if;
end $$;
select public.remove_member(current_setting('pc.campaign')::uuid,current_setting('pc.player')::uuid);
select set_config('request.jwt.claim.sub',current_setting('pc.player'),true);
do $$ begin
  if exists(select 1 from public.campaigns where id=current_setting('pc.campaign')::uuid) then raise exception 'SMOKE: access retained after removal'; end if;
end $$;
rollback;
select 'passed: campaign, roster, email targeting, acceptance, replay, player isolation, permissions, removal; all fixtures rolled back' as result;
