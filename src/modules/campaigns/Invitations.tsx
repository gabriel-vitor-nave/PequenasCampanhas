import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { Check, Mail, X } from 'lucide-react'
import { Button, ErrorNotice, Loading } from '../../components/ui/primitives'
import { dateLabel } from '../../lib/validation'
import { useInvitations } from './hooks'
import { campaignService } from './service'

export function Invitations() {
  const query = useInvitations()
  const cache = useQueryClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const mutation = useMutation({ mutationFn: ({ id, accept }: { id: string; accept: boolean }) => campaignService.respond(id, accept), onSuccess: async (id, variables) => { await cache.invalidateQueries(); if (variables.accept) navigate(`/campanhas/${id}`) } })
  if (query.isPending) return <Loading label="Buscando convites…" />
  if (query.isError) return <ErrorNotice error={query.error} />
  return <><ErrorNotice error={mutation.error} />{query.data.length ? <div className="invitation-list">{query.data.map(invite => <div key={invite.id} className={`invitation ${params.get('convite') === invite.id ? 'highlight' : ''}`}><span className="invitation-icon"><Mail size={20} /></span><div><h3>{invite.campaign_name}</h3><p>Convite para jogar · válido até {dateLabel(invite.expires_at)}</p></div><div className="invitation-actions"><Button variant="ghost" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: invite.id, accept: false })} aria-label={`Recusar convite para ${invite.campaign_name}`}><X size={16} /><span>Recusar</span></Button><Button variant="secondary" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: invite.id, accept: true })}><Check size={16} />Aceitar</Button></div></div>)}</div> : <div className="inline-empty"><Mail size={20} /><div><strong>Nenhum convite pendente</strong><p>Quando alguém convidar este e-mail, o convite aparecerá aqui.</p>{params.has('convite') && <p>Se você recebeu um link, entre com o e-mail convidado. Convites expirados ou respondidos não aparecem.</p>}</div></div>}</>
}
