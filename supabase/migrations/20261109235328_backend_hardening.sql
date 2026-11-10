-- Expose SECURITY INVOKER entrypoints; keep privileged implementations private.
-- The implementations retain their auth.uid(), membership and email checks.
create index campaigns_owner_id_idx on public.campaigns(owner_id);
create index campaign_invites_invited_by_idx on public.campaign_invites(invited_by);
create index activity_logs_actor_id_idx on public.activity_logs(actor_id);

alter function public.create_campaign(text,text) set schema private;
alter function public.invite_player(uuid,text) set schema private;
alter function public.respond_to_invite(uuid,boolean) set schema private;
alter function public.revoke_invite(uuid) set schema private;
alter function public.update_member_permissions(uuid,uuid,boolean,boolean) set schema private;
alter function public.remove_member(uuid,uuid) set schema private;
alter function public.my_invitations() set schema private;
alter function public.campaign_roster(uuid) security invoker;

create function public.create_campaign(p_name text, p_description text default '') returns uuid
language sql security invoker set search_path = '' as $$ select private.create_campaign(p_name,p_description); $$;
create function public.invite_player(p_campaign_id uuid, p_email text) returns uuid
language sql security invoker set search_path = '' as $$ select private.invite_player(p_campaign_id,p_email); $$;
create function public.respond_to_invite(p_invite_id uuid, p_accept boolean) returns uuid
language sql security invoker set search_path = '' as $$ select private.respond_to_invite(p_invite_id,p_accept); $$;
create function public.revoke_invite(p_invite_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.revoke_invite(p_invite_id); $$;
create function public.update_member_permissions(p_campaign_id uuid, p_user_id uuid, p_can_draw boolean, p_can_move_tokens boolean) returns void
language sql security invoker set search_path = '' as $$ select private.update_member_permissions(p_campaign_id,p_user_id,p_can_draw,p_can_move_tokens); $$;
create function public.remove_member(p_campaign_id uuid, p_user_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.remove_member(p_campaign_id,p_user_id); $$;
create function public.my_invitations() returns table(id uuid, campaign_id uuid, campaign_name text, email text, expires_at timestamptz)
language sql security invoker set search_path = '' as $$ select * from private.my_invitations(); $$;

revoke all on function public.create_campaign(text,text), public.invite_player(uuid,text), public.respond_to_invite(uuid,boolean),
  public.revoke_invite(uuid), public.update_member_permissions(uuid,uuid,boolean,boolean), public.remove_member(uuid,uuid),
  public.my_invitations() from public, anon;
grant execute on function public.create_campaign(text,text), public.invite_player(uuid,text), public.respond_to_invite(uuid,boolean),
  public.revoke_invite(uuid), public.update_member_permissions(uuid,uuid,boolean,boolean), public.remove_member(uuid,uuid),
  public.my_invitations() to authenticated;
