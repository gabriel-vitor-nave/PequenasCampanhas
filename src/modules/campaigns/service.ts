import { backend } from '../../lib/supabase'
import { campaignInput } from '../../lib/validation'
import type { Campaign } from '../../types/database'

export const campaignService = {
  async list() {
    const { data, error } = await backend().from('campaigns').select('*').order('updated_at', { ascending: false })
    if (error) throw error
    return data
  },
  async get(id: string) {
    const { data, error } = await backend().from('campaigns').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data
  },
  async create(name: string, description: string) {
    const input = campaignInput(name, description)
    const { data, error } = await backend().rpc('create_campaign', { p_name: input.name, p_description: input.description })
    if (error) throw error
    return data
  },
  async update(id: string, input: Partial<Pick<Campaign, 'name' | 'description' | 'status'>>) {
    const { data, error } = await backend().from('campaigns').update(input).eq('id', id).select('id').single()
    if (error) throw error
    return data
  },
  async delete(id: string) {
    const { data, error } = await backend().from('campaigns').delete().eq('id', id).select('id').single()
    if (error) throw error
    return data
  },
  async roster(id: string) {
    const { data, error } = await backend().rpc('campaign_roster', { p_campaign_id: id })
    if (error) throw error
    return data
  },
  async pendingInvites(id: string) {
    const { data, error } = await backend().from('campaign_invites').select('*').eq('campaign_id', id).eq('status', 'pending').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false })
    if (error) throw error
    return data
  },
  async invite(id: string, username: string) {
    const { data, error } = await backend().rpc('invite_player_by_username', { p_campaign_id: id, p_username: username.trim().toLowerCase() })
    if (error) throw error
    return data
  },
  async invitations() {
    const { data, error } = await backend().rpc('my_invitations')
    if (error) throw error
    return data
  },
  async respond(id: string, accept: boolean) {
    const { data, error } = await backend().rpc('respond_to_invite', { p_invite_id: id, p_accept: accept })
    if (error) throw error
    return data
  },
  async revoke(id: string) {
    const { error } = await backend().rpc('revoke_invite', { p_invite_id: id })
    if (error) throw error
  },
  async permissions(campaignId: string, userId: string, draw: boolean, tokens: boolean) {
    const { error } = await backend().rpc('update_member_permissions', { p_campaign_id: campaignId, p_user_id: userId, p_can_draw: draw, p_can_move_tokens: tokens })
    if (error) throw error
  },
  async remove(campaignId: string, userId: string) {
    const { error } = await backend().rpc('remove_member', { p_campaign_id: campaignId, p_user_id: userId })
    if (error) throw error
  },
  async activity(campaignId?: string) {
    let request = backend().from('activity_logs').select('*').order('created_at', { ascending: false }).limit(12)
    if (campaignId) request = request.eq('campaign_id', campaignId)
    const { data, error } = await request
    if (error) throw error
    return data
  },
}
