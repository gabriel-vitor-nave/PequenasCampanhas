// Phase-1 schema contract. Regenerate after migration changes (see README).
import type { Asset,Scene,TableState,Token,Drawing,Roll,Combatant,Combat,Music,Sfx } from '../modules/table/types'
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type Profile = { id: string; username: string | null; display_name: string; avatar_url: string | null; preferences: Json; created_at: string; updated_at: string }
export type Campaign = { id: string; owner_id: string; name: string; description: string; system: 'dnd5e-2024'; status: 'active' | 'archived'; created_at: string; updated_at: string }
export type Membership = { campaign_id: string; user_id: string; role: 'gm' | 'player'; can_draw: boolean; can_move_tokens: boolean; joined_at: string }
export type CampaignInvite = { id: string; campaign_id: string; username: string | null; email: string; invited_by: string; status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired'; expires_at: string; created_at: string }
export type Invitation = Pick<CampaignInvite, 'id' | 'campaign_id' | 'email' | 'expires_at'> & { campaign_name: string }
export type Member = Omit<Membership, 'campaign_id'> & { display_name: string; avatar_url: string | null }
export type Activity = { id: string; campaign_id: string; actor_id: string | null; event: string; summary: string; created_at: string }
type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] }
type Rpc<Args, Returns> = { Args: Args; Returns: Returns }
export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, Partial<Profile>, Pick<Partial<Profile>, 'display_name' | 'avatar_url' | 'preferences'>>
      campaigns: Table<Campaign, never, Pick<Partial<Campaign>, 'name' | 'description' | 'status'>>
      campaign_members: Table<Membership, never, never>
      campaign_invites: Table<CampaignInvite, never, never>
      activity_logs: Table<Activity, never, never>
      table_assets: Table<Asset,never,never>
      table_scenes: Table<Scene>
      table_state: Table<TableState,never,never>
      table_tokens: Table<Token>
      table_drawings: Table<Drawing>
      table_rolls: Table<Roll,never,never>
      table_combatants: Table<Combatant>
      table_combat: Table<Combat,never,never>
      table_music: Table<Music,never,never>
      table_sfx: Table<Sfx,never,never>
    }
    Views: Record<string, never>
    Functions: {
      create_campaign: Rpc<{ p_name: string; p_description: string }, string>
      invite_player_by_username: Rpc<{ p_campaign_id: string; p_username: string }, string>
      respond_to_invite: Rpc<{ p_invite_id: string; p_accept: boolean }, string>
      revoke_invite: Rpc<{ p_invite_id: string }, undefined>
      update_member_permissions: Rpc<{ p_campaign_id: string; p_user_id: string; p_can_draw: boolean; p_can_move_tokens: boolean }, undefined>
      remove_member: Rpc<{ p_campaign_id: string; p_user_id: string }, undefined>
      my_invitations: Rpc<Record<string, never>, Invitation[]>
      campaign_roster: Rpc<{ p_campaign_id: string }, Member[]>
      ensure_table: Rpc<{p_campaign_id:string},string|null>
      manage_table_scene: Rpc<{p_campaign_id:string;p_scene_id:string|null;p_action:string;p_name:string;p_request_id:string},string>
      move_table_tokens: Rpc<{p_scene_id:string;p_moves:Json;p_request_id:string},Json>
      roll_table_dice: Rpc<{p_campaign_id:string;p_expression:string;p_visibility:string;p_label:string;p_request_id:string},string>
      table_combat_action: Rpc<{p_scene_id:string;p_action:string;p_direction:number;p_request_id:string},Json>
      adjust_table_hp: Rpc<{p_token_id:string;p_delta:number;p_request_id:string},Json>
      set_table_music: Rpc<{p_campaign_id:string;p_asset_id:string|null;p_playing:boolean;p_loop:boolean;p_position:number;p_volume:number;p_request_id:string},Json>
      emit_table_sfx: Rpc<{p_campaign_id:string;p_asset_id:string|null;p_action:string;p_volume:number;p_request_id:string},string>
      table_server_time: Rpc<Record<string,never>,string>
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
