// Phase-1 schema contract. Regenerate after migration changes (see README).
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type Profile = { id: string; display_name: string; avatar_url: string | null; preferences: Json; created_at: string; updated_at: string }
export type Campaign = { id: string; owner_id: string; name: string; description: string; system: 'dnd5e-2024'; status: 'active' | 'archived'; created_at: string; updated_at: string }
export type Membership = { campaign_id: string; user_id: string; role: 'gm' | 'player'; can_draw: boolean; can_move_tokens: boolean; joined_at: string }
export type CampaignInvite = { id: string; campaign_id: string; email: string; invited_by: string; status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired'; expires_at: string; created_at: string }
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
    }
    Views: Record<string, never>
    Functions: {
      create_campaign: Rpc<{ p_name: string; p_description: string }, string>
      invite_player: Rpc<{ p_campaign_id: string; p_email: string }, string>
      respond_to_invite: Rpc<{ p_invite_id: string; p_accept: boolean }, string>
      revoke_invite: Rpc<{ p_invite_id: string }, undefined>
      update_member_permissions: Rpc<{ p_campaign_id: string; p_user_id: string; p_can_draw: boolean; p_can_move_tokens: boolean }, undefined>
      remove_member: Rpc<{ p_campaign_id: string; p_user_id: string }, undefined>
      my_invitations: Rpc<Record<string, never>, Invitation[]>
      campaign_roster: Rpc<{ p_campaign_id: string }, Member[]>
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
