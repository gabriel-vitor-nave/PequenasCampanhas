-- Campaign tabletop. No existing account/campaign data is replaced.
create table public.table_assets (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null check(char_length(name) between 1 and 160),
  kind text not null check(kind in('map','token','audio')),
  path text not null unique,
  mime text not null,
  bytes integer not null check(bytes between 1 and 26214400),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(campaign_id,id)
);
create index table_assets_campaign_idx on public.table_assets(campaign_id);
create index table_assets_creator_idx on public.table_assets(created_by);

create table public.table_scenes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null default 'Cena' check(char_length(btrim(name)) between 1 and 80),
  is_public boolean not null default false,
  map_asset_id uuid,
  map_x double precision not null default 0 check(abs(map_x)<=100000),
  map_y double precision not null default 0 check(abs(map_y)<=100000),
  map_width double precision not null default 1600 check(map_width between 1 and 30000),
  map_height double precision not null default 1000 check(map_height between 1 and 30000),
  map_locked boolean not null default true,
  grid_visible boolean not null default true,
  grid_type text not null default 'square' check(grid_type in('square','hex')),
  grid_size double precision not null default 64 check(grid_size between 16 and 256),
  grid_x double precision not null default 0 check(abs(grid_x)<=10000),
  grid_y double precision not null default 0 check(abs(grid_y)<=10000),
  grid_color text not null default '#8993a5' check(grid_color ~ '^#[0-9a-fA-F]{6}$'),
  grid_opacity double precision not null default .25 check(grid_opacity between 0 and 1),
  unit_distance double precision not null default 1.5 check(unit_distance between .1 and 1000),
  unit text not null default 'm' check(char_length(unit) between 1 and 12),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(campaign_id,id),
  foreign key(campaign_id,map_asset_id) references public.table_assets(campaign_id,id)
);
create index table_scenes_campaign_idx on public.table_scenes(campaign_id);
create index table_scenes_map_idx on public.table_scenes(campaign_id,map_asset_id);

create table public.table_state (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  active_scene_id uuid,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  foreign key(campaign_id,active_scene_id) references public.table_scenes(campaign_id,id)
);

create table public.table_tokens (
  id uuid primary key,
  campaign_id uuid not null,
  scene_id uuid not null,
  name text not null default 'Token' check(char_length(btrim(name)) between 1 and 80),
  asset_id uuid,
  x double precision not null default 0 check(abs(x)<=100000),
  y double precision not null default 0 check(abs(y)<=100000),
  size double precision not null default 1 check(size between .25 and 20),
  rotation double precision not null default 0 check(abs(rotation)<=36000),
  shape text not null default 'circle' check(shape in('circle','square','none')),
  color text not null default '#5385ce' check(color ~ '^#[0-9a-fA-F]{6}$'),
  owner_ids uuid[] not null default '{}',
  visible boolean not null default true,
  locked boolean not null default false,
  show_hp boolean not null default true,
  hp integer not null default 10 check(hp between 0 and 9999),
  max_hp integer not null default 10 check(max_hp between 1 and 9999),
  temp_hp integer not null default 0 check(temp_hp between 0 and 9999),
  ac integer not null default 10 check(ac between 0 and 100),
  initiative_bonus integer not null default 0 check(initiative_bonus between -30 and 30),
  conditions text[] not null default '{}' check(cardinality(conditions)<=16 and octet_length(conditions::text)<=1000),
  concentration boolean not null default false,
  z_index integer not null default 0 check(abs(z_index)<=100000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(campaign_id,scene_id) references public.table_scenes(campaign_id,id) on delete cascade,
  foreign key(campaign_id,asset_id) references public.table_assets(campaign_id,id),
  unique(campaign_id,scene_id,id)
);
create index table_tokens_scene_idx on public.table_tokens(campaign_id,scene_id);
create index table_tokens_asset_idx on public.table_tokens(campaign_id,asset_id);

create function private.valid_table_points(points jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare p jsonb;
begin
  if jsonb_typeof(points)<>'array' or jsonb_array_length(points) not between 1 and 2048 or pg_column_size(points)>65536 then return false; end if;
  for p in select value from jsonb_array_elements(points) loop
    if jsonb_typeof(p)<>'array' or jsonb_array_length(p)<>2 or jsonb_typeof(p->0)<>'number' or jsonb_typeof(p->1)<>'number' then return false; end if;
    if abs((p->>0)::double precision)>100000 or abs((p->>1)::double precision)>100000 then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $$;
revoke all on function private.valid_table_points(jsonb) from public,anon;
grant execute on function private.valid_table_points(jsonb) to authenticated,service_role;

create table public.table_drawings (
  id uuid primary key,
  campaign_id uuid not null,
  scene_id uuid not null,
  created_by uuid not null references public.profiles(id),
  visibility text not null default 'shared' check(visibility in('shared','gm')),
  tool text not null check(tool in('pencil','line','rect','ellipse','arrow','text')),
  points jsonb not null check(private.valid_table_points(points)),
  color text not null default '#86b1f2' check(color ~ '^#[0-9a-fA-F]{6}$'),
  width double precision not null default 3 check(width between 1 and 40),
  opacity double precision not null default 1 check(opacity between .05 and 1),
  text text not null default '' check(char_length(text)<=2000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(campaign_id,scene_id) references public.table_scenes(campaign_id,id) on delete cascade
);
create index table_drawings_scene_idx on public.table_drawings(campaign_id,scene_id);
create index table_drawings_creator_idx on public.table_drawings(created_by);

create table public.table_rolls (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  expression text not null check(char_length(expression)<=64),
  label text not null default '' check(char_length(label)<=80),
  visibility text not null default 'shared' check(visibility in('shared','gm')),
  "values" integer[] not null,
  kept integer[] not null,
  modifier integer not null,
  total integer not null,
  created_at timestamptz not null default now()
);
create index table_rolls_campaign_date_idx on public.table_rolls(campaign_id,created_at desc);
create index table_rolls_user_idx on public.table_rolls(user_id);

create table public.table_combatants (
  campaign_id uuid not null,
  scene_id uuid not null,
  token_id uuid primary key,
  initiative integer check(initiative between -1000 and 1000),
  created_at timestamptz not null default now(),
  foreign key(campaign_id,scene_id,token_id) references public.table_tokens(campaign_id,scene_id,id) on delete cascade
);
create index table_combatants_scene_idx on public.table_combatants(campaign_id,scene_id);
create table public.table_combat (
  scene_id uuid primary key,
  campaign_id uuid not null,
  started boolean not null default false,
  round integer not null default 1 check(round between 1 and 99999),
  active_token_id uuid references public.table_tokens(id) on delete set null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  foreign key(campaign_id,scene_id) references public.table_scenes(campaign_id,id) on delete cascade
);
create index table_combat_campaign_idx on public.table_combat(campaign_id);
create index table_combat_active_idx on public.table_combat(active_token_id);

create table public.table_music (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  asset_id uuid,
  playing boolean not null default false,
  loop boolean not null default false,
  volume double precision not null default .7 check(volume between 0 and 1),
  position double precision not null default 0 check(position between 0 and 86400),
  started_at timestamptz not null default now(),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  foreign key(campaign_id,asset_id) references public.table_assets(campaign_id,id)
);
create index table_music_asset_idx on public.table_music(campaign_id,asset_id);
create table public.table_sfx (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  asset_id uuid,
  action text not null check(action in('play','stop')),
  volume double precision not null default 1 check(volume between 0 and 1),
  created_at timestamptz not null default now(),
  foreign key(campaign_id,asset_id) references public.table_assets(campaign_id,id)
);
create index table_sfx_campaign_date_idx on public.table_sfx(campaign_id,created_at desc);
create index table_sfx_asset_idx on public.table_sfx(campaign_id,asset_id);

create table private.table_requests (
  id uuid primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  resource_id uuid,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table private.table_requests enable row level security;
create index table_requests_campaign_idx on private.table_requests(campaign_id);
create index table_requests_actor_idx on private.table_requests(actor_id);
revoke all on private.table_requests from public,anon,authenticated;

create function private.table_stamp() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=now(); new.version:=old.version+1; return new; end $$;
create trigger table_scenes_stamp before update on public.table_scenes for each row execute function private.table_stamp();
create trigger table_state_stamp before update on public.table_state for each row execute function private.table_stamp();
create trigger table_tokens_stamp before update on public.table_tokens for each row execute function private.table_stamp();
create trigger table_drawings_stamp before update on public.table_drawings for each row execute function private.table_stamp();
create trigger table_combat_stamp before update on public.table_combat for each row execute function private.table_stamp();
create trigger table_music_stamp before update on public.table_music for each row execute function private.table_stamp();
revoke all on function private.table_stamp() from public,anon,authenticated;

create function private.can_read_scene(target uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.table_scenes s where s.id=target and private.is_member(s.campaign_id) and(s.is_public or private.is_gm(s.campaign_id)));
$$;
create function private.can_read_table_asset(target uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.table_assets a where a.id=target and private.is_member(a.campaign_id) and(
    private.is_gm(a.campaign_id)
    or exists(select 1 from public.table_scenes s where s.map_asset_id=a.id and s.campaign_id=a.campaign_id and s.is_public)
    or exists(select 1 from public.table_tokens t join public.table_scenes s on s.id=t.scene_id where t.asset_id=a.id and t.campaign_id=a.campaign_id and t.visible and s.is_public)
    or exists(select 1 from public.table_music m where m.asset_id=a.id and m.campaign_id=a.campaign_id)
    or exists(select 1 from public.table_sfx x where x.asset_id=a.id and x.campaign_id=a.campaign_id)
  ));
$$;
create function private.can_read_table_file(target text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.table_assets a where a.path=target and private.can_read_table_asset(a.id));
$$;
create function private.can_draw_in_scene(target uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.table_scenes s join public.campaign_members m on m.campaign_id=s.campaign_id where s.id=target and m.user_id=(select auth.uid()) and(m.role='gm' or(s.is_public and m.can_draw)));
$$;
create function private.table_topic_allowed(target text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.campaign_members m where m.user_id=(select auth.uid()) and target='table:'||m.campaign_id::text);
$$;
revoke all on function private.can_read_scene(uuid),private.can_read_table_asset(uuid),private.can_read_table_file(text),private.can_draw_in_scene(uuid),private.table_topic_allowed(text) from public,anon;
grant execute on function private.can_read_scene(uuid),private.can_read_table_asset(uuid),private.can_read_table_file(text),private.can_draw_in_scene(uuid),private.table_topic_allowed(text) to authenticated;

alter table public.table_assets enable row level security;
alter table public.table_scenes enable row level security;
alter table public.table_state enable row level security;
alter table public.table_tokens enable row level security;
alter table public.table_drawings enable row level security;
alter table public.table_rolls enable row level security;
alter table public.table_combatants enable row level security;
alter table public.table_combat enable row level security;
alter table public.table_music enable row level security;
alter table public.table_sfx enable row level security;
revoke all on public.table_assets,public.table_scenes,public.table_state,public.table_tokens,public.table_drawings,public.table_rolls,public.table_combatants,public.table_combat,public.table_music,public.table_sfx from anon,authenticated;
grant select on public.table_assets,public.table_scenes,public.table_state,public.table_tokens,public.table_drawings,public.table_rolls,public.table_combatants,public.table_combat,public.table_music,public.table_sfx to authenticated;
grant insert,delete on public.table_tokens,public.table_drawings,public.table_combatants to authenticated;
grant update(name,is_public,map_asset_id,map_x,map_y,map_width,map_height,map_locked,grid_visible,grid_type,grid_size,grid_x,grid_y,grid_color,grid_opacity,unit_distance,unit) on public.table_scenes to authenticated;
grant update(name,asset_id,x,y,size,rotation,shape,color,owner_ids,visible,locked,show_hp,hp,max_hp,temp_hp,ac,initiative_bonus,conditions,concentration,z_index) on public.table_tokens to authenticated;
grant update(points,color,width,opacity,text,visibility) on public.table_drawings to authenticated;
grant update(initiative) on public.table_combatants to authenticated;

create policy table_assets_read on public.table_assets for select to authenticated using(private.can_read_table_asset(id));
create policy table_scenes_read on public.table_scenes for select to authenticated using(private.can_read_scene(id));
create policy table_scenes_edit on public.table_scenes for update to authenticated using(private.is_gm(campaign_id)) with check(private.is_gm(campaign_id));
create policy table_state_read on public.table_state for select to authenticated using(private.is_member(campaign_id));
create policy table_tokens_read on public.table_tokens for select to authenticated using(private.can_read_scene(scene_id) and(visible or private.is_gm(campaign_id)));
create policy table_tokens_insert on public.table_tokens for insert to authenticated with check(private.is_gm(campaign_id));
create policy table_tokens_edit on public.table_tokens for update to authenticated using(private.is_gm(campaign_id)) with check(private.is_gm(campaign_id));
create policy table_tokens_delete on public.table_tokens for delete to authenticated using(private.is_gm(campaign_id));
create policy table_drawings_read on public.table_drawings for select to authenticated using(private.can_read_scene(scene_id) and(visibility='shared' or private.is_gm(campaign_id)));
create policy table_drawings_insert on public.table_drawings for insert to authenticated with check(private.is_gm(campaign_id) or(private.can_draw_in_scene(scene_id) and created_by=(select auth.uid()) and visibility='shared'));
create policy table_drawings_edit on public.table_drawings for update to authenticated using(private.is_gm(campaign_id) or(created_by=(select auth.uid()) and private.can_draw_in_scene(scene_id))) with check(private.is_gm(campaign_id) or(created_by=(select auth.uid()) and visibility='shared' and private.can_draw_in_scene(scene_id)));
create policy table_drawings_delete on public.table_drawings for delete to authenticated using(private.is_gm(campaign_id) or(created_by=(select auth.uid()) and private.can_draw_in_scene(scene_id)));
create policy table_rolls_read on public.table_rolls for select to authenticated using(private.is_member(campaign_id) and(visibility='shared' or private.is_gm(campaign_id)));
create policy table_combatants_read on public.table_combatants for select to authenticated using(private.can_read_scene(scene_id) and exists(select 1 from public.table_tokens t where t.id=token_id));
create policy table_combatants_insert on public.table_combatants for insert to authenticated with check(private.is_gm(campaign_id));
create policy table_combatants_edit on public.table_combatants for update to authenticated using(private.is_gm(campaign_id)) with check(private.is_gm(campaign_id));
create policy table_combatants_delete on public.table_combatants for delete to authenticated using(private.is_gm(campaign_id));
create policy table_combat_read on public.table_combat for select to authenticated using(private.can_read_scene(scene_id));
create policy table_music_read on public.table_music for select to authenticated using(private.is_member(campaign_id));
create policy table_sfx_read on public.table_sfx for select to authenticated using(private.is_member(campaign_id));

-- Storage writes occur only through the authenticated upload function (service role).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('campaign-assets','campaign-assets',false,26214400,array['image/jpeg','image/png','image/webp','audio/mpeg','audio/wav','audio/ogg','audio/webm','audio/mp4'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy table_files_read on storage.objects for select to authenticated using(bucket_id='campaign-assets' and private.can_read_table_file(name));
create policy table_presence_read on realtime.messages for select to authenticated using(private.table_topic_allowed((select realtime.topic())));
create policy table_presence_write on realtime.messages for insert to authenticated with check(private.table_topic_allowed((select realtime.topic())));

alter publication supabase_realtime add table public.table_assets,public.table_scenes,public.table_state,public.table_tokens,public.table_drawings,public.table_rolls,public.table_combatants,public.table_combat,public.table_music,public.table_sfx;

grant select,insert,delete on public.table_assets to service_role;

create function private.table_request(p_campaign uuid,p_id uuid,p_kind text,p_resource uuid) returns jsonb
language plpgsql set search_path='' as $$
declare previous private.table_requests;
begin
  if p_id is null then raise exception 'PC_INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into previous from private.table_requests where id=p_id;
  if found then
    if previous.actor_id is distinct from auth.uid() or previous.campaign_id<>p_campaign or previous.kind<>p_kind or previous.resource_id is distinct from p_resource then raise exception 'PC_CONFLICT'; end if;
    return previous.result;
  end if;
  return null;
end $$;
revoke all on function private.table_request(uuid,uuid,text,uuid) from public,anon,authenticated;

create function private.ensure_table(p_campaign_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare active uuid;
begin
  if not private.is_member(p_campaign_id) then raise exception 'PC_FORBIDDEN'; end if;
  perform 1 from public.campaigns where id=p_campaign_id for update;
  select active_scene_id into active from public.table_state where campaign_id=p_campaign_id;
  if active is null and private.is_gm(p_campaign_id) then
    insert into public.table_scenes(campaign_id,name,is_public) values(p_campaign_id,'Cena 1',true) returning id into active;
    insert into public.table_state(campaign_id,active_scene_id) values(p_campaign_id,active) on conflict(campaign_id) do update set active_scene_id=excluded.active_scene_id;
  end if;
  insert into public.table_music(campaign_id) values(p_campaign_id) on conflict do nothing;
  if active is not null then insert into public.table_combat(scene_id,campaign_id) values(active,p_campaign_id) on conflict do nothing; end if;
  return active;
end $$;
create function public.ensure_table(p_campaign_id uuid) returns uuid language sql security invoker set search_path='' as $$ select private.ensure_table(p_campaign_id); $$;

create function private.manage_table_scene(p_campaign_id uuid,p_scene_id uuid,p_action text,p_name text,p_request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; source public.table_scenes; cached jsonb;
begin
  if not private.is_gm(p_campaign_id) then raise exception 'PC_FORBIDDEN'; end if;
  cached:=private.table_request(p_campaign_id,p_request_id,'scene:'||p_action,p_scene_id);
  if cached is not null then return (cached->>'id')::uuid; end if;
  perform 1 from public.campaigns where id=p_campaign_id for update;
  if p_action='create' then
    insert into public.table_scenes(campaign_id,name) values(p_campaign_id,btrim(p_name)) returning id into result;
    insert into public.table_combat(scene_id,campaign_id) values(result,p_campaign_id);
  else
    select * into source from public.table_scenes where id=p_scene_id and campaign_id=p_campaign_id for update;
    if not found then raise exception 'PC_NOT_FOUND'; end if;
    result:=p_scene_id;
    if p_action='activate' then
      update public.table_scenes set is_public=true where id=p_scene_id;
      insert into public.table_state(campaign_id,active_scene_id) values(p_campaign_id,p_scene_id) on conflict(campaign_id) do update set active_scene_id=excluded.active_scene_id;
    elsif p_action='duplicate' then
      insert into public.table_scenes(campaign_id,name,map_asset_id,map_x,map_y,map_width,map_height,map_locked,grid_visible,grid_type,grid_size,grid_x,grid_y,grid_color,grid_opacity,unit_distance,unit)
      values(p_campaign_id,left(source.name||' — cópia',80),source.map_asset_id,source.map_x,source.map_y,source.map_width,source.map_height,source.map_locked,source.grid_visible,source.grid_type,source.grid_size,source.grid_x,source.grid_y,source.grid_color,source.grid_opacity,source.unit_distance,source.unit) returning id into result;
      insert into public.table_tokens(id,campaign_id,scene_id,name,asset_id,x,y,size,rotation,shape,color,owner_ids,visible,locked,show_hp,hp,max_hp,temp_hp,ac,initiative_bonus,conditions,concentration,z_index)
      select gen_random_uuid(),campaign_id,result,name,asset_id,x,y,size,rotation,shape,color,owner_ids,visible,locked,show_hp,hp,max_hp,temp_hp,ac,initiative_bonus,conditions,concentration,z_index from public.table_tokens where scene_id=p_scene_id;
      insert into public.table_drawings(id,campaign_id,scene_id,created_by,visibility,tool,points,color,width,opacity,text)
      select gen_random_uuid(),campaign_id,result,auth.uid(),visibility,tool,points,color,width,opacity,text from public.table_drawings where scene_id=p_scene_id;
      insert into public.table_combat(scene_id,campaign_id) values(result,p_campaign_id);
    elsif p_action='delete' then
      update public.table_state set active_scene_id=(select id from public.table_scenes where campaign_id=p_campaign_id and id<>p_scene_id and is_public order by created_at limit 1)
        where campaign_id=p_campaign_id and active_scene_id=p_scene_id;
      delete from public.table_scenes where id=p_scene_id;
    else raise exception 'PC_INVALID_INPUT'; end if;
  end if;
  insert into private.table_requests(id,campaign_id,actor_id,kind,resource_id,result) values(p_request_id,p_campaign_id,auth.uid(),'scene:'||p_action,p_scene_id,jsonb_build_object('id',result));
  return result;
end $$;
create function public.manage_table_scene(p_campaign_id uuid,p_scene_id uuid,p_action text,p_name text,p_request_id uuid) returns uuid
language sql security invoker set search_path='' as $$ select private.manage_table_scene(p_campaign_id,p_scene_id,p_action,p_name,p_request_id); $$;

create function private.move_table_tokens(p_scene_id uuid,p_moves jsonb,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare scene public.table_scenes; t public.table_tokens; movement jsonb; cached jsonb; result jsonb:='[]'; gm boolean; can_move boolean;
begin
  select * into scene from public.table_scenes where id=p_scene_id;
  if not found or not private.can_read_scene(p_scene_id) then raise exception 'PC_FORBIDDEN'; end if;
  gm:=private.is_gm(scene.campaign_id);
  select can_move_tokens into can_move from public.campaign_members where campaign_id=scene.campaign_id and user_id=auth.uid();
  if not gm and not coalesce(can_move,false) then raise exception 'PC_FORBIDDEN'; end if;
  cached:=private.table_request(scene.campaign_id,p_request_id,'move',p_scene_id);
  if cached is not null then return cached; end if;
  if jsonb_typeof(p_moves)<>'array' or jsonb_array_length(p_moves) not between 1 and 64 then raise exception 'PC_INVALID_INPUT'; end if;
  for movement in select value from jsonb_array_elements(p_moves) order by value->>'id' loop
    select * into t from public.table_tokens where id=(movement->>'id')::uuid and scene_id=p_scene_id for update;
    if not found or(not gm and(not t.visible or t.locked or not(auth.uid()=any(t.owner_ids)))) then raise exception 'PC_FORBIDDEN'; end if;
    if movement->>'x' is null or movement->>'y' is null or movement->>'version' is null then raise exception 'PC_INVALID_INPUT'; end if;
    if t.version<>(movement->>'version')::integer then raise exception 'PC_CONFLICT'; end if;
    update public.table_tokens set x=(movement->>'x')::double precision,y=(movement->>'y')::double precision where id=t.id returning * into t;
    result:=result||jsonb_build_array(jsonb_build_object('id',t.id,'x',t.x,'y',t.y,'version',t.version));
  end loop;
  insert into private.table_requests(id,campaign_id,actor_id,kind,resource_id,result) values(p_request_id,scene.campaign_id,auth.uid(),'move',p_scene_id,result);
  return result;
end $$;
create function public.move_table_tokens(p_scene_id uuid,p_moves jsonb,p_request_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.move_table_tokens(p_scene_id,p_moves,p_request_id); $$;

create function private.table_random(p_sides integer) returns integer language plpgsql volatile set search_path='' as $$
declare bytes bytea; value bigint; ceiling bigint;
begin
  if p_sides not between 2 and 100 then raise exception 'PC_INVALID_INPUT'; end if;
  ceiling:=(4294967296::bigint/p_sides)*p_sides;
  loop
    bytes:=extensions.gen_random_bytes(4);
    value:=get_byte(bytes,0)::bigint*16777216+get_byte(bytes,1)::bigint*65536+get_byte(bytes,2)::bigint*256+get_byte(bytes,3);
    exit when value<ceiling;
  end loop;
  return (value%p_sides)::integer+1;
end $$;
revoke all on function private.table_random(integer) from public,anon,authenticated;

create function private.roll_table_dice(p_campaign_id uuid,p_expression text,p_visibility text,p_label text,p_request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare parts text[]; expression text; amount integer; sides integer; keep_count integer; modifier integer; results integer[]:='{}'; kept integer[]; total integer; existing public.table_rolls;
begin
  if not private.is_member(p_campaign_id) or(p_visibility='gm' and not private.is_gm(p_campaign_id)) then raise exception 'PC_FORBIDDEN'; end if;
  if p_request_id is null then raise exception 'PC_INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into existing from public.table_rolls where id=p_request_id;
  if found then
    if existing.campaign_id<>p_campaign_id or existing.user_id<>auth.uid() then raise exception 'PC_CONFLICT'; end if;
    return existing.id;
  end if;
  expression:=lower(regexp_replace(p_expression,'\s','','g'));
  parts:=regexp_match(expression,'^([1-9][0-9]?)d(100|20|12|10|8|6|4)(?:(kh|kl)([1-9][0-9]?))?([+-][0-9]{1,4})?$');
  if parts is null then raise exception 'PC_INVALID_DICE'; end if;
  amount:=parts[1]::integer; sides:=parts[2]::integer; keep_count:=coalesce(parts[4]::integer,amount); modifier:=coalesce(parts[5]::integer,0);
  if amount>40 or keep_count>amount or keep_count<1 then raise exception 'PC_INVALID_DICE'; end if;
  for i in 1..amount loop results:=array_append(results,private.table_random(sides)); end loop;
  select array_agg(n) into kept from(select n from unnest(results) n order by case when parts[3]='kh' then -n else n end limit keep_count) chosen;
  select coalesce(sum(n),0)+modifier into total from unnest(kept) n;
  insert into public.table_rolls(id,campaign_id,user_id,expression,label,visibility,"values",kept,modifier,total)
    values(p_request_id,p_campaign_id,auth.uid(),expression,p_label,p_visibility,results,kept,modifier,total);
  return p_request_id;
end $$;
create function public.roll_table_dice(p_campaign_id uuid,p_expression text,p_visibility text,p_label text,p_request_id uuid) returns uuid
language sql security invoker set search_path='' as $$ select private.roll_table_dice(p_campaign_id,p_expression,p_visibility,p_label,p_request_id); $$;

create function private.table_combat_action(p_scene_id uuid,p_action text,p_direction integer,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare scene public.table_scenes; combat public.table_combat; c record; ordered uuid[]; current_index integer; next_index integer; cached jsonb; result jsonb; roll_id uuid;
begin
  select * into scene from public.table_scenes where id=p_scene_id;
  if not found or not private.is_gm(scene.campaign_id) then raise exception 'PC_FORBIDDEN'; end if;
  cached:=private.table_request(scene.campaign_id,p_request_id,'combat:'||p_action,p_scene_id); if cached is not null then return cached; end if;
  insert into public.table_combat(scene_id,campaign_id) values(p_scene_id,scene.campaign_id) on conflict do nothing;
  select * into combat from public.table_combat where scene_id=p_scene_id for update;
  if p_action='initiative' then
    for c in select t.id,t.name,t.initiative_bonus,t.visible from public.table_combatants b join public.table_tokens t on t.id=b.token_id where b.scene_id=p_scene_id order by t.id loop
      roll_id:=private.roll_table_dice(scene.campaign_id,'1d20'||case when c.initiative_bonus>=0 then '+' else '' end||c.initiative_bonus,case when c.visible then 'shared' else 'gm' end,'Iniciativa: '||left(c.name,60),md5(p_request_id::text||c.id::text)::uuid);
      update public.table_combatants set initiative=(select total from public.table_rolls where id=roll_id) where token_id=c.id;
    end loop;
  elsif p_action='end' then update public.table_combat set started=false,active_token_id=null,round=1 where scene_id=p_scene_id;
  elsif p_action in('start','step') then
    select array_agg(token_id order by initiative desc nulls last,created_at,token_id) into ordered from public.table_combatants where scene_id=p_scene_id;
    if coalesce(cardinality(ordered),0)=0 then raise exception 'PC_EMPTY_COMBAT'; end if;
    if p_action='start' or not combat.started then
      update public.table_combat set started=true,round=1,active_token_id=ordered[1] where scene_id=p_scene_id;
    else
      if p_direction not in(-1,1) then raise exception 'PC_INVALID_INPUT'; end if;
      current_index:=coalesce(array_position(ordered,combat.active_token_id),1); next_index:=current_index+p_direction;
      if next_index>cardinality(ordered) then next_index:=1; combat.round:=combat.round+1;
      elsif next_index<1 then next_index:=cardinality(ordered); combat.round:=greatest(1,combat.round-1); end if;
      update public.table_combat set active_token_id=ordered[next_index],round=combat.round where scene_id=p_scene_id;
    end if;
  else raise exception 'PC_INVALID_INPUT'; end if;
  select to_jsonb(x) into result from public.table_combat x where scene_id=p_scene_id;
  insert into private.table_requests(id,campaign_id,actor_id,kind,resource_id,result) values(p_request_id,scene.campaign_id,auth.uid(),'combat:'||p_action,p_scene_id,result);
  return result;
end $$;
create function public.table_combat_action(p_scene_id uuid,p_action text,p_direction integer,p_request_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.table_combat_action(p_scene_id,p_action,p_direction,p_request_id); $$;

create function private.adjust_table_hp(p_token_id uuid,p_delta integer,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.table_tokens; cached jsonb; result jsonb; damage integer;
begin
  select * into t from public.table_tokens where id=p_token_id;
  if not found or not private.is_gm(t.campaign_id) then raise exception 'PC_FORBIDDEN'; end if;
  cached:=private.table_request(t.campaign_id,p_request_id,'hp',p_token_id); if cached is not null then return cached; end if;
  select * into t from public.table_tokens where id=p_token_id for update;
  if not found then raise exception 'PC_NOT_FOUND'; end if;
  if abs(p_delta)>9999 then raise exception 'PC_INVALID_INPUT'; end if;
  if p_delta<0 then damage:=-p_delta; t.hp:=greatest(0,t.hp-greatest(0,damage-t.temp_hp)); t.temp_hp:=greatest(0,t.temp_hp-damage);
  else t.hp:=least(t.max_hp,t.hp+p_delta); end if;
  update public.table_tokens set hp=t.hp,temp_hp=t.temp_hp where id=t.id returning to_jsonb(table_tokens.*) into result;
  insert into private.table_requests(id,campaign_id,actor_id,kind,resource_id,result) values(p_request_id,t.campaign_id,auth.uid(),'hp',p_token_id,result);
  return result;
end $$;
create function public.adjust_table_hp(p_token_id uuid,p_delta integer,p_request_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.adjust_table_hp(p_token_id,p_delta,p_request_id); $$;

create function private.set_table_music(p_campaign_id uuid,p_asset_id uuid,p_playing boolean,p_loop boolean,p_position double precision,p_volume double precision,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cached jsonb; result jsonb;
begin
  if not private.is_gm(p_campaign_id) then raise exception 'PC_FORBIDDEN'; end if;
  cached:=private.table_request(p_campaign_id,p_request_id,'music',p_campaign_id); if cached is not null then return cached; end if;
  if p_asset_id is not null and not exists(select 1 from public.table_assets where id=p_asset_id and campaign_id=p_campaign_id and kind='audio') then raise exception 'PC_INVALID_INPUT'; end if;
  insert into public.table_music(campaign_id,asset_id,playing,loop,position,volume,started_at)
    values(p_campaign_id,p_asset_id,p_playing and p_asset_id is not null,p_loop,p_position,p_volume,now())
    on conflict(campaign_id) do update set asset_id=excluded.asset_id,playing=excluded.playing,loop=excluded.loop,position=excluded.position,volume=excluded.volume,started_at=excluded.started_at returning to_jsonb(table_music.*) into result;
  insert into private.table_requests(id,campaign_id,actor_id,kind,resource_id,result) values(p_request_id,p_campaign_id,auth.uid(),'music',p_campaign_id,result);
  return result;
end $$;
create function public.set_table_music(p_campaign_id uuid,p_asset_id uuid,p_playing boolean,p_loop boolean,p_position double precision,p_volume double precision,p_request_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.set_table_music(p_campaign_id,p_asset_id,p_playing,p_loop,p_position,p_volume,p_request_id); $$;

create function private.emit_table_sfx(p_campaign_id uuid,p_asset_id uuid,p_action text,p_volume double precision,p_request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare cached jsonb;
begin
  if not private.is_gm(p_campaign_id) then raise exception 'PC_FORBIDDEN'; end if;
  cached:=private.table_request(p_campaign_id,p_request_id,'sfx',p_campaign_id); if cached is not null then return (cached->>'id')::uuid; end if;
  if p_action='play' and not exists(select 1 from public.table_assets where id=p_asset_id and campaign_id=p_campaign_id and kind='audio') then raise exception 'PC_INVALID_INPUT'; end if;
  insert into public.table_sfx(id,campaign_id,asset_id,action,volume) values(p_request_id,p_campaign_id,p_asset_id,p_action,p_volume);
  insert into private.table_requests(id,campaign_id,actor_id,kind,resource_id,result) values(p_request_id,p_campaign_id,auth.uid(),'sfx',p_campaign_id,jsonb_build_object('id',p_request_id));
  return p_request_id;
end $$;
create function public.emit_table_sfx(p_campaign_id uuid,p_asset_id uuid,p_action text,p_volume double precision,p_request_id uuid) returns uuid
language sql security invoker set search_path='' as $$ select private.emit_table_sfx(p_campaign_id,p_asset_id,p_action,p_volume,p_request_id); $$;
create function public.table_server_time() returns timestamptz language sql stable security invoker set search_path='' as $$ select now(); $$;

revoke all on function private.ensure_table(uuid),public.ensure_table(uuid),private.manage_table_scene(uuid,uuid,text,text,uuid),public.manage_table_scene(uuid,uuid,text,text,uuid),
  private.move_table_tokens(uuid,jsonb,uuid),public.move_table_tokens(uuid,jsonb,uuid),private.roll_table_dice(uuid,text,text,text,uuid),public.roll_table_dice(uuid,text,text,text,uuid),
  private.table_combat_action(uuid,text,integer,uuid),public.table_combat_action(uuid,text,integer,uuid),private.adjust_table_hp(uuid,integer,uuid),public.adjust_table_hp(uuid,integer,uuid),
  private.set_table_music(uuid,uuid,boolean,boolean,double precision,double precision,uuid),public.set_table_music(uuid,uuid,boolean,boolean,double precision,double precision,uuid),
  private.emit_table_sfx(uuid,uuid,text,double precision,uuid),public.emit_table_sfx(uuid,uuid,text,double precision,uuid),public.table_server_time() from public,anon;
grant execute on function private.ensure_table(uuid),public.ensure_table(uuid),private.manage_table_scene(uuid,uuid,text,text,uuid),public.manage_table_scene(uuid,uuid,text,text,uuid),
  private.move_table_tokens(uuid,jsonb,uuid),public.move_table_tokens(uuid,jsonb,uuid),private.roll_table_dice(uuid,text,text,text,uuid),public.roll_table_dice(uuid,text,text,text,uuid),
  private.table_combat_action(uuid,text,integer,uuid),public.table_combat_action(uuid,text,integer,uuid),private.adjust_table_hp(uuid,integer,uuid),public.adjust_table_hp(uuid,integer,uuid),
  private.set_table_music(uuid,uuid,boolean,boolean,double precision,double precision,uuid),public.set_table_music(uuid,uuid,boolean,boolean,double precision,double precision,uuid),
  private.emit_table_sfx(uuid,uuid,text,double precision,uuid),public.emit_table_sfx(uuid,uuid,text,double precision,uuid),public.table_server_time() to authenticated;

-- An authorized, payload-free revision also covers deletes and newly hidden rows.
-- Clients never need unfiltered DELETE subscriptions or private resource payloads.
create function private.table_changed() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  if tg_op='DELETE' then target:=old.campaign_id; else target:=new.campaign_id; end if;
  update public.table_state set updated_at=now() where campaign_id=target;
  return null;
end $$;
revoke all on function private.table_changed() from public,anon,authenticated;
create trigger table_asset_changed after insert or update or delete on public.table_assets for each row execute function private.table_changed();
create trigger table_scene_changed after insert or update or delete on public.table_scenes for each row execute function private.table_changed();
create trigger table_token_changed after insert or update or delete on public.table_tokens for each row execute function private.table_changed();
create trigger table_drawing_changed after insert or update or delete on public.table_drawings for each row execute function private.table_changed();
create trigger table_roll_changed after insert on public.table_rolls for each row execute function private.table_changed();
create trigger table_combatant_changed after insert or update or delete on public.table_combatants for each row execute function private.table_changed();
create trigger table_combat_changed after insert or update on public.table_combat for each row execute function private.table_changed();
create trigger table_music_changed after insert or update on public.table_music for each row execute function private.table_changed();
create trigger table_sfx_changed after insert on public.table_sfx for each row execute function private.table_changed();
