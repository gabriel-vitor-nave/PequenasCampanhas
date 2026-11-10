-- Application identities are usernames. Internal Auth addresses are not contact emails.
alter table public.profiles add column username text unique
  check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');
alter table public.campaign_invites add column username text;
alter table public.campaign_invites add column invitee_id uuid references public.profiles(id) on delete cascade;
create index campaign_invites_invitee_id_idx on public.campaign_invites(invitee_id);

do $$ declare p record; candidate text; begin
  for p in select id,display_name from public.profiles where username is null order by created_at,id loop
    candidate := left(trim(both '_-.' from regexp_replace(lower(p.display_name),'[^a-z0-9._-]+','_','g')),32);
    if char_length(candidate)<3 or candidate !~ '^[a-z0-9]' then candidate := 'jogador_'||left(replace(p.id::text,'-',''),8); end if;
    while exists(select 1 from public.profiles where username=candidate) loop
      candidate := left(candidate,19)||'_'||right(replace(gen_random_uuid()::text,'-',''),12);
    end loop;
    update public.profiles set username=candidate where id=p.id;
  end loop;
end $$;

-- Existing Auth credentials remain untouched here. Legacy identities are converted only
-- by the access function after the owner proves knowledge of the current password.
update public.campaign_invites i set username=p.username,invitee_id=p.id
from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=i.email;

-- A server-only check for accounts created before username access. Never returns a hash.
create function private.verify_legacy_password(p_user_id uuid,p_password text) returns boolean
language plpgsql security definer set search_path='' as $$
declare valid boolean;
begin
  if p_password is null or octet_length(p_password)>72 then return false; end if;
  select coalesce(u.encrypted_password like '$2%' and extensions.crypt(p_password,u.encrypted_password)=u.encrypted_password,false)
    into valid from auth.users u where u.id=p_user_id and u.email not like '%@accounts.pequenas-campanhas.invalid';
  return coalesce(valid,false);
end $$;
revoke all on function private.verify_legacy_password(uuid,text) from public,anon,authenticated;
grant execute on function private.verify_legacy_password(uuid,text) to service_role;
create function public.verify_legacy_password(p_user_id uuid,p_password text) returns boolean
language sql security invoker set search_path='' as $$ select private.verify_legacy_password(p_user_id,p_password); $$;
revoke all on function public.verify_legacy_password(uuid,text) from public,anon,authenticated;
grant execute on function public.verify_legacy_password(uuid,text) to service_role;

create table private.auth_rate_limits (
  bucket text primary key check(char_length(bucket) between 1 and 160),
  window_start timestamptz not null,
  hits integer not null
);
alter table private.auth_rate_limits enable row level security;
create index auth_rate_limits_window_idx on private.auth_rate_limits(window_start);
revoke all on private.auth_rate_limits from public,anon,authenticated;
grant usage on schema private to service_role;
grant select,insert,update,delete on private.auth_rate_limits to service_role;
grant update(username) on public.profiles to service_role;

create function public.claim_auth_attempt(p_bucket text,p_limit integer,p_seconds integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare allowed boolean;
begin
  if p_limit not between 1 and 10000 or p_seconds not between 1 and 86400 then raise exception 'PC_INVALID_INPUT'; end if;
  delete from private.auth_rate_limits where window_start < now()-interval '1 day';
  insert into private.auth_rate_limits(bucket,window_start,hits) values(p_bucket,now(),1)
  on conflict(bucket) do update set
    window_start=case when private.auth_rate_limits.window_start<=now()-make_interval(secs=>p_seconds) then now() else private.auth_rate_limits.window_start end,
    hits=case when private.auth_rate_limits.window_start<=now()-make_interval(secs=>p_seconds) then 1 else least(private.auth_rate_limits.hits+1,p_limit+1) end
  returning hits<=p_limit into allowed;
  return allowed;
end $$;
revoke all on function public.claim_auth_attempt(text,integer,integer) from public,anon,authenticated;
grant execute on function public.claim_auth_attempt(text,integer,integer) to service_role;

create function private.invite_player_by_username(p_campaign_id uuid,p_username text) returns uuid
language plpgsql security definer set search_path='' as $$
declare target_email text; target_username text; target_id uuid; invitation uuid;
begin
  if not private.is_gm(p_campaign_id) then raise exception 'PC_FORBIDDEN'; end if;
  if exists(select 1 from public.campaigns where id=p_campaign_id and status='archived') then raise exception 'PC_ARCHIVED'; end if;
  select u.email,p.username,p.id into target_email,target_username,target_id from public.profiles p join auth.users u on u.id=p.id where p.username=lower(btrim(p_username));
  if target_email is null then raise exception 'PC_USERNAME_NOT_FOUND'; end if;
  invitation:=private.invite_player(p_campaign_id,target_email);
  update public.campaign_invites set username=target_username,invitee_id=target_id where id=invitation;
  return invitation;
end $$;
revoke all on function private.invite_player_by_username(uuid,text) from public,anon;
grant execute on function private.invite_player_by_username(uuid,text) to authenticated;
create function public.invite_player_by_username(p_campaign_id uuid,p_username text) returns uuid
language sql security invoker set search_path='' as $$ select private.invite_player_by_username(p_campaign_id,p_username); $$;
revoke all on function public.invite_player_by_username(uuid,text) from public,anon;
grant execute on function public.invite_player_by_username(uuid,text) to authenticated;
revoke all on function public.invite_player(uuid,text),private.invite_player(uuid,text) from authenticated;

-- Invitations follow immutable user IDs, including after a legacy account conversion.
drop policy invites_read on public.campaign_invites;
create policy invites_read on public.campaign_invites for select to authenticated using (
  private.is_gm(campaign_id) or invitee_id=(select auth.uid()) or (invitee_id is null and email=private.current_email())
);
create or replace function private.respond_to_invite(p_invite_id uuid,p_accept boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare invitation public.campaign_invites; target uuid;
begin
  select campaign_id into target from public.campaign_invites where id=p_invite_id;
  perform 1 from public.campaigns where id=target for update;
  select * into invitation from public.campaign_invites where id=p_invite_id for update;
  if invitation.id is null or auth.uid() is null or
    (invitation.invitee_id is not null and invitation.invitee_id is distinct from auth.uid()) or
    (invitation.invitee_id is null and invitation.email is distinct from private.current_email()) then raise exception 'PC_FORBIDDEN'; end if;
  if invitation.status<>'pending' or invitation.expires_at<=now() then raise exception 'PC_INVITE_EXPIRED'; end if;
  if p_accept and exists(select 1 from public.campaigns where id=target and status='archived') then raise exception 'PC_ARCHIVED'; end if;
  if p_accept then insert into public.campaign_members(campaign_id,user_id,role) values(target,auth.uid(),'player') on conflict do nothing; end if;
  update public.campaign_invites set status=case when p_accept then 'accepted' else 'declined' end where id=p_invite_id;
  insert into public.activity_logs(campaign_id,actor_id,event,summary) values(target,auth.uid(),
    case when p_accept then 'member.joined' else 'invite.declined' end,
    case when p_accept then 'Um participante entrou na campanha.' else 'Um convite foi recusado.' end);
  return target;
end $$;
create or replace function private.my_invitations() returns table(id uuid,campaign_id uuid,campaign_name text,email text,expires_at timestamptz)
language sql stable security definer set search_path='' as $$
  select i.id,i.campaign_id,c.name,i.email,i.expires_at from public.campaign_invites i join public.campaigns c on c.id=i.campaign_id
  where (i.invitee_id=(select auth.uid()) or (i.invitee_id is null and i.email=private.current_email()))
    and i.status='pending' and i.expires_at>now() order by i.created_at desc;
$$;
