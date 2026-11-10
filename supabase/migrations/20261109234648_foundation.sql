-- Phase 1: all privileged writes validate identity inside PostgreSQL.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Aventureiro' check (char_length(btrim(display_name)) between 2 and 60),
  avatar_url text check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 2048)),
  preferences jsonb not null default '{"compact":false}'::jsonb
    check (jsonb_typeof(preferences) = 'object' and preferences - 'compact' = '{}'::jsonb
      and (not preferences ? 'compact' or jsonb_typeof(preferences->'compact') = 'boolean')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 3 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  system text not null default 'dnd5e-2024' check (system = 'dnd5e-2024'),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'player' check (role in ('gm','player')),
  can_draw boolean not null default true,
  can_move_tokens boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);
create index campaign_members_user_idx on public.campaign_members(user_id);

create table public.campaign_invites (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  invited_by uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','accepted','declined','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);
create unique index campaign_invite_pending_idx on public.campaign_invites(campaign_id,email) where status = 'pending';
create index campaign_invites_email_idx on public.campaign_invites(email);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event text not null,
  summary text not null,
  created_at timestamptz not null default now()
);
create index activity_logs_campaign_date_idx on public.activity_logs(campaign_id,created_at desc);

create function private.is_member(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.campaign_members where campaign_id = target and user_id = (select auth.uid()));
$$;
create function private.is_gm(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.campaign_members where campaign_id = target and user_id = (select auth.uid()) and role = 'gm');
$$;
create function private.current_email() returns text language sql stable security definer set search_path = '' as $$
  select lower(email) from auth.users where id = (select auth.uid()) and email_confirmed_at is not null;
$$;
create function private.shares_campaign(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.campaign_members a join public.campaign_members b using(campaign_id)
    where a.user_id = (select auth.uid()) and b.user_id = target);
$$;

create function private.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger profiles_updated before update on public.profiles for each row execute function private.set_updated_at();
create trigger campaigns_updated before update on public.campaigns for each row execute function private.set_updated_at();

create function private.on_signup() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,
    case when char_length(btrim(new.raw_user_meta_data->>'display_name')) between 2 and 60
      then btrim(new.raw_user_meta_data->>'display_name') else 'Aventureiro' end);
  return new;
end;
$$;
create trigger auth_user_created after insert on auth.users for each row execute function private.on_signup();

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.campaign_invites enable row level security;
alter table public.activity_logs enable row level security;

-- No anonymous table access; role/owner changes are never writable by the client.
revoke all on public.profiles, public.campaigns, public.campaign_members, public.campaign_invites, public.activity_logs from anon, authenticated;
grant select on public.profiles, public.campaigns, public.campaign_members, public.campaign_invites, public.activity_logs to authenticated;
grant update(display_name,avatar_url,preferences) on public.profiles to authenticated;
grant update(name,description,status) on public.campaigns to authenticated;
grant delete on public.campaigns to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()) or private.shares_campaign(id));
create policy profiles_edit on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy campaigns_read on public.campaigns for select to authenticated using (private.is_member(id));
create policy campaigns_edit on public.campaigns for update to authenticated using (private.is_gm(id)) with check (private.is_gm(id));
create policy campaigns_delete on public.campaigns for delete to authenticated using (owner_id = (select auth.uid()));
create policy members_read on public.campaign_members for select to authenticated using (private.is_member(campaign_id));
create policy invites_read on public.campaign_invites for select to authenticated using (private.is_gm(campaign_id) or email = private.current_email());
create policy activity_read on public.activity_logs for select to authenticated using (private.is_member(campaign_id));

create function public.create_campaign(p_name text, p_description text default '') returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'PC_UNAUTHENTICATED'; end if;
  insert into public.campaigns(owner_id,name,description) values(auth.uid(),btrim(p_name),btrim(p_description)) returning id into result;
  insert into public.campaign_members(campaign_id,user_id,role) values(result,auth.uid(),'gm');
  insert into public.activity_logs(campaign_id,actor_id,event,summary) values(result,auth.uid(),'campaign.created','Campanha criada.');
  return result;
end;
$$;

create function public.invite_player(p_campaign_id uuid, p_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid; normalized text := lower(btrim(p_email));
begin
  -- Serialize invitation creation and membership changes within this campaign.
  perform 1 from public.campaigns where id = p_campaign_id for update;
  if not private.is_gm(p_campaign_id) then raise exception 'PC_FORBIDDEN'; end if;
  if exists (select 1 from public.campaigns where id = p_campaign_id and status = 'archived') then raise exception 'PC_ARCHIVED'; end if;
  if exists (select 1 from public.campaign_members m join auth.users u on m.user_id = u.id where m.campaign_id = p_campaign_id and lower(u.email) = normalized) then raise exception 'PC_ALREADY_MEMBER'; end if;
  update public.campaign_invites set status = 'expired' where campaign_id = p_campaign_id and status = 'pending' and expires_at <= now();
  if (select count(*) from public.campaign_invites where campaign_id = p_campaign_id and status = 'pending') >= 20 then raise exception 'PC_INVITE_LIMIT'; end if;
  insert into public.campaign_invites(campaign_id,email,invited_by) values(p_campaign_id,normalized,auth.uid()) returning id into result;
  insert into public.activity_logs(campaign_id,actor_id,event,summary) values(p_campaign_id,auth.uid(),'member.invited','Convite de participação criado.');
  return result;
end;
$$;

create function public.respond_to_invite(p_invite_id uuid, p_accept boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare invitation public.campaign_invites; target uuid;
begin
  -- Same lock order as invite_player: campaign, then invite. Recheck every condition under lock.
  select campaign_id into target from public.campaign_invites where id = p_invite_id;
  perform 1 from public.campaigns where id = target for update;
  select * into invitation from public.campaign_invites where id = p_invite_id for update;
  if invitation.id is null or invitation.email is distinct from private.current_email() then raise exception 'PC_FORBIDDEN'; end if;
  if invitation.status <> 'pending' or invitation.expires_at <= now() then raise exception 'PC_INVITE_EXPIRED'; end if;
  if p_accept and exists (select 1 from public.campaigns where id = target and status = 'archived') then raise exception 'PC_ARCHIVED'; end if;
  if p_accept then
    insert into public.campaign_members(campaign_id,user_id,role) values(target,auth.uid(),'player') on conflict do nothing;
  end if;
  update public.campaign_invites set status = case when p_accept then 'accepted' else 'declined' end where id = p_invite_id;
  insert into public.activity_logs(campaign_id,actor_id,event,summary) values(target,auth.uid(),
    case when p_accept then 'member.joined' else 'invite.declined' end,
    case when p_accept then 'Um participante entrou na campanha.' else 'Um convite foi recusado.' end);
  return target;
end;
$$;

create function public.revoke_invite(p_invite_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  select campaign_id into target from public.campaign_invites where id = p_invite_id;
  perform 1 from public.campaigns where id = target for update;
  if target is null or not private.is_gm(target) then raise exception 'PC_FORBIDDEN'; end if;
  update public.campaign_invites set status = 'revoked' where id = p_invite_id and status = 'pending';
  insert into public.activity_logs(campaign_id,actor_id,event,summary) values(target,auth.uid(),'invite.revoked','Convite revogado.');
end;
$$;

create function public.update_member_permissions(p_campaign_id uuid, p_user_id uuid, p_can_draw boolean, p_can_move_tokens boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.campaigns where id = p_campaign_id for update;
  if not private.is_gm(p_campaign_id) then raise exception 'PC_FORBIDDEN'; end if;
  update public.campaign_members set can_draw = p_can_draw, can_move_tokens = p_can_move_tokens
    where campaign_id = p_campaign_id and user_id = p_user_id and role = 'player';
  if not found then raise exception 'PC_MEMBER_NOT_FOUND'; end if;
  insert into public.activity_logs(campaign_id,actor_id,event,summary) values(p_campaign_id,auth.uid(),'member.permissions','Permissões de participante atualizadas.');
end;
$$;

create function public.remove_member(p_campaign_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.campaigns where id = p_campaign_id for update;
  if not private.is_gm(p_campaign_id) and auth.uid() is distinct from p_user_id then raise exception 'PC_FORBIDDEN'; end if;
  delete from public.campaign_members where campaign_id = p_campaign_id and user_id = p_user_id and role = 'player';
  if not found then raise exception 'PC_MEMBER_NOT_FOUND'; end if;
  insert into public.activity_logs(campaign_id,actor_id,event,summary) values(p_campaign_id,auth.uid(),'member.removed','Um participante saiu da campanha.');
end;
$$;

create function public.my_invitations() returns table(id uuid, campaign_id uuid, campaign_name text, email text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id,i.campaign_id,c.name,i.email,i.expires_at from public.campaign_invites i join public.campaigns c on c.id = i.campaign_id
    where i.email = private.current_email() and i.status = 'pending' and i.expires_at > now() order by i.created_at desc;
$$;

create function public.campaign_roster(p_campaign_id uuid)
returns table(user_id uuid, display_name text, avatar_url text, role text, can_draw boolean, can_move_tokens boolean, joined_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.user_id,p.display_name,p.avatar_url,m.role,m.can_draw,m.can_move_tokens,m.joined_at
  from public.campaign_members m join public.profiles p on p.id = m.user_id
  where m.campaign_id = p_campaign_id and private.is_member(p_campaign_id) order by m.role,m.joined_at;
$$;

create function private.log_campaign_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.activity_logs(campaign_id,actor_id,event,summary) values(new.id,auth.uid(),'campaign.updated',
    case when new.status is distinct from old.status then
      case when new.status = 'archived' then 'Campanha arquivada.' else 'Campanha reativada.' end
    else 'Informações da campanha atualizadas.' end);
  return new;
end;
$$;
create trigger campaign_change after update on public.campaigns for each row execute function private.log_campaign_change();

-- Functions default to PUBLIC execution in PostgreSQL: remove it explicitly.
revoke all on all functions in schema private from public, anon;
grant execute on function private.is_member(uuid), private.is_gm(uuid), private.current_email(), private.shares_campaign(uuid) to authenticated;
revoke all on function public.create_campaign(text,text), public.invite_player(uuid,text), public.respond_to_invite(uuid,boolean),
  public.revoke_invite(uuid), public.update_member_permissions(uuid,uuid,boolean,boolean), public.remove_member(uuid,uuid),
  public.my_invitations(), public.campaign_roster(uuid) from public, anon;
grant execute on function public.create_campaign(text,text), public.invite_player(uuid,text), public.respond_to_invite(uuid,boolean),
  public.revoke_invite(uuid), public.update_member_permissions(uuid,uuid,boolean,boolean), public.remove_member(uuid,uuid),
  public.my_invitations(), public.campaign_roster(uuid) to authenticated;

-- Inserts/updates are filtered by SELECT policies. DELETE payloads are not used
-- for authority: clients refetch after focus/reconnect and after every mutation.
alter publication supabase_realtime add table public.campaigns, public.campaign_members, public.campaign_invites, public.activity_logs;
