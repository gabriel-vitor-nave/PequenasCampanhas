import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { backend } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { campaignService } from './service'

export function useCampaigns() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['campaigns', user?.id], queryFn: campaignService.list, enabled: !!user })
}
export function useInvitations() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['invitations', user?.id], queryFn: campaignService.invitations, enabled: !!user, refetchInterval: 30_000 })
}
export function useCampaignRealtime() {
  const client = useQueryClient()
  const { user } = useAuth()
  useEffect(() => {
    if (!user) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const invalidate = () => {
      clearTimeout(timer)
      timer = setTimeout(() => { void client.invalidateQueries({ predicate: query => query.queryKey[0] !== 'profile' }) }, 150)
    }
    const channel = backend().channel(`foundation:${user.id}`)
    for (const table of ['campaigns', 'campaign_members', 'campaign_invites', 'activity_logs']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, invalidate)
    }
    channel.subscribe(status => { if (status === 'SUBSCRIBED') invalidate() })
    return () => { clearTimeout(timer); void backend().removeChannel(channel) }
  }, [client, user])
}
