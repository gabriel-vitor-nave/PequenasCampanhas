import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArrowLeft, BookOpen, CalendarDays, History, Pencil, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { Badge, Button, Dialog, ErrorNotice, Loading } from '../../components/ui/primitives'
import { dateLabel } from '../../lib/validation'
import { useAuth } from '../auth/AuthProvider'
import { campaignService } from './service'
import { CampaignForm } from './CampaignForm'
import { MembersPanel } from './MembersPanel'
import type { Campaign } from '../../types/database'

function CampaignSettings({ campaign }: { campaign: Campaign }) {
  const cache = useQueryClient()
  const navigate = useNavigate()
  const [edit, setEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const archive = useMutation({ mutationFn: () => campaignService.update(campaign.id, { status: campaign.status === 'active' ? 'archived' : 'active' }), onSuccess: () => cache.invalidateQueries() })
  const remove = useMutation({ mutationFn: () => campaignService.delete(campaign.id), onSuccess: async () => { navigate('/campanhas', { replace: true }); await cache.invalidateQueries() } })
  return <><section className="panel"><h2>Informações da campanha</h2><p className="muted">Nome, descrição e sistema utilizado pelo grupo.</p><Button variant="secondary" onClick={() => setEdit(true)}><Pencil size={16} />Editar informações</Button></section><section className="panel"><h2>{campaign.status === 'active' ? 'Arquivar campanha' : 'Reativar campanha'}</h2><p className="muted">{campaign.status === 'active' ? 'Guarde a campanha sem apagar seu histórico. Convites ficam suspensos enquanto ela estiver arquivada.' : 'Permite enviar convites novamente.'}</p><ErrorNotice error={archive.error} /><Button variant="secondary" busy={archive.isPending} onClick={() => archive.mutate()}>{campaign.status === 'active' ? <Archive size={16} /> : <RotateCcw size={16} />}{campaign.status === 'active' ? 'Arquivar campanha' : 'Reativar campanha'}</Button></section><section className="panel danger-panel"><h2>Excluir campanha</h2><p className="muted">Remove a campanha, os participantes, os convites e o histórico. Esta ação é permanente.</p><Button variant="danger" onClick={() => setDeleting(true)}><Trash2 size={16} />Excluir campanha</Button></section>
    {edit && <CampaignForm campaign={campaign} onClose={() => setEdit(false)} />}{deleting && <Dialog title="Excluir campanha?" onClose={() => { if (!remove.isPending) setDeleting(false) }}><p>Todos os dados da campanha serão removidos permanentemente. Digite <strong>{campaign.name}</strong> para confirmar.</p><label>Nome da campanha<input autoFocus value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label><ErrorNotice error={remove.error} /><div className="dialog-actions"><Button variant="secondary" disabled={remove.isPending} onClick={() => setDeleting(false)}>Cancelar</Button><Button variant="danger" disabled={confirmation !== campaign.name} busy={remove.isPending} onClick={() => remove.mutate()}>Excluir permanentemente</Button></div></Dialog>}
  </>
}
function CampaignActivity({ id }: { id: string }) {
  const query = useQuery({ queryKey: ['activity', 'campaign', id], queryFn: () => campaignService.activity(id) })
  return <section className="panel"><div className="section-heading"><h2><History size={18} />Histórico da campanha</h2><span className="help-text">12 eventos mais recentes</span></div>{query.isPending ? <Loading /> : query.isError ? <ErrorNotice error={query.error} /> : <ul className="activity-list">{query.data.map(event => <li key={event.id}><span className="activity-dot" /><div><strong>{event.summary}</strong><small>{dateLabel(event.created_at)} · {new Date(event.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small></div></li>)}</ul>}</section>
}
export function CampaignDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [tab, setTab] = useState('overview')
  const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const query = useQuery({ queryKey: ['campaign', id], queryFn: () => campaignService.get(id), enabled: validId, refetchInterval: 30_000 })
  if (validId && query.isPending) return <Loading />
  if (query.isError) return <><ErrorNotice error={query.error} /><Button variant="secondary" onClick={() => void query.refetch()}>Tentar novamente</Button></>
  const campaign = query.data
  if (!campaign) return <div className="panel"><h1>Campanha indisponível</h1><p>Ela não existe, foi excluída ou você não tem acesso.</p><Link to="/campanhas" className="text-link"><ArrowLeft size={16} />Voltar para campanhas</Link></div>
  const gm = campaign.owner_id === user?.id
  const tabs = [['overview','Visão geral'],['members','Participantes'],['activity','Atividades'],...(gm ? [['settings','Configurações']] : [])]
  return <><Link to="/campanhas" className="back-link"><ArrowLeft size={15} />Todas as campanhas</Link><div className="page-heading campaign-heading"><div><div className="campaign-status"><Badge tone={campaign.status === 'active' ? 'green' : 'muted'}>{campaign.status === 'active' ? 'Em andamento' : 'Arquivada'}</Badge><Badge tone={gm ? 'gold' : 'muted'}>{gm ? 'Você é o mestre' : 'Você é jogador'}</Badge></div><h1>{campaign.name}</h1><p>Dungeons & Dragons · 5ª edição · 2024</p></div><Link className="button button-primary" to={`/campanhas/${id}/mesa`}>Abrir mesa</Link></div>
    <div className="tabs" role="tablist" aria-label="Seções da campanha">{tabs.map(([key, label]) => <button key={key} role="tab" id={`tab-${key}`} aria-controls="campaign-panel" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>)}</div>
    <div className="tab-content" id="campaign-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>{tab === 'overview' ? <><div className="detail-columns"><section className="panel campaign-about"><h2>Descrição</h2><p className="preserve-lines">{campaign.description || 'Sem descrição.'}</p><div className="campaign-facts"><span><BookOpen size={16} />D&D 5e · 2024</span><span><CalendarDays size={16} />Criada em {dateLabel(campaign.created_at)}</span><span><ShieldCheck size={16} />Acesso restrito aos participantes</span></div></section></div><CampaignActivity id={id} /></> : tab === 'members' ? <MembersPanel campaignId={id} gm={gm} archived={campaign.status === 'archived'} /> : tab === 'activity' ? <CampaignActivity id={id} /> : gm ? <CampaignSettings campaign={campaign} /> : null}</div>
  </>
}
