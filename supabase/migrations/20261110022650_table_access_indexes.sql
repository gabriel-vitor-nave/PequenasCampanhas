-- Cover composite foreign keys used by scene deletion and campaign lookups.
create index table_combat_campaign_scene_idx on public.table_combat(campaign_id,scene_id);
create index table_combatants_scene_token_idx on public.table_combatants(campaign_id,scene_id,token_id);
create index table_state_scene_idx on public.table_state(campaign_id,active_scene_id);
