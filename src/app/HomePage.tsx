import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Compass, History, Plus, UsersRound } from 'lucide-react'
import { useProfile } from '../components/layout/AppLayout'
import { Badge, Button, EmptyState, ErrorNotice, Loading } from '../components/ui/primitives'
import { useCampaigns } from '../modules/campaigns/hooks'
import { campaignService } from '../modules/campaigns/service'
import { CampaignCard } from '../modules/campaigns/CampaignCard'
import { CampaignForm } from '../modules/campaigns/CampaignForm'
import { Invitations } from '../modules/campaigns/Invitations'
import { dateLabel } from '../lib/validation'
import { useAuth } from '../modules/auth/AuthProvider'

export function HomePage() {
  const profile = useProfile()
  const { user } = useAuth()
  const campaigns = useCampaigns()
  const activity = useQuery({ queryKey: ['activity', user?.id], queryFn: () => campaignService.activity() })
  const [create, setCreate] = useState(false)
  const active = campaigns.data?.filter(campaign => campaign.status === 'active') ?? []
  const name = profile.data?.display_name.split(' ')[0]
  return <><div className="page-heading"><div><div className="eyebrow">SEU PONTO DE ENCONTRO</div><h1>{name ? `Bom ter você aqui, ${name}` : 'Bom ter você aqui'}<span className="heading-dot">.</span></h1><p>As melhores histórias são as que a gente constrói junto.</p></div><Button onClick={() => setCreate(true)}><Plus size={17} />Nova campanha</Button></div>
    <ErrorNotice error={profile.error} /><section className="home-banner"><div><Badge tone="gold">O próximo capítulo</Badge><h2>Prepare os dados.<br />Reúna sua companhia.</h2><p>Seu espaço para organizar aventuras, encontrar<br className="desktop-break" /> seu grupo e manter cada história por perto.</p><Link to="/campanhas" className="text-link">Explorar minhas campanhas <ArrowRight size={16} /></Link></div><div className="banner-mark" aria-hidden="true"><Compass size={190} strokeWidth={0.55} /><span>EM BOA COMPANHIA,<br />TODA HISTÓRIA VAI ALÉM.</span></div></section>
    <section className="content-section"><div className="section-heading"><h2><Compass size={19} />Campanhas em andamento <Badge>{active.length}</Badge></h2><Link className="text-link muted" to="/campanhas">Ver todas <ArrowRight size={15} /></Link></div>
      {campaigns.isPending ? <Loading /> : campaigns.isError ? <ErrorNotice error={campaigns.error} /> : active.length ? <div className="campaign-grid">{active.slice(0, 3).map(campaign => <CampaignCard campaign={campaign} key={campaign.id} />)}</div> : <EmptyState icon={<Compass size={31} strokeWidth={1.2} />} title="Há um mundo inteiro esperando." action={<Button variant="secondary" onClick={() => setCreate(true)}><Plus size={16} />Criar campanha</Button>}>Crie sua primeira campanha ou aceite um convite abaixo para se juntar ao grupo.</EmptyState>}
    </section><div className="home-columns"><section className="panel"><div className="section-heading"><h2><UsersRound size={18} />Convites para você</h2></div><Invitations /></section><section className="panel"><div className="section-heading"><h2><History size={18} />Últimos acontecimentos</h2></div>{activity.isPending ? <Loading /> : activity.isError ? <ErrorNotice error={activity.error} /> : activity.data.length ? <ul className="activity-list">{activity.data.slice(0, 5).map(event => <li key={event.id}><span className="activity-dot" /><div><Link to={`/campanhas/${event.campaign_id}`}>{event.summary}</Link><small>{dateLabel(event.created_at)}</small></div></li>)}</ul> : <div className="inline-empty"><History size={20} /><div><strong>Uma página em branco</strong><p>As atividades das suas campanhas aparecerão aqui.</p></div></div>}</section></div>
    {create && <CampaignForm onClose={() => setCreate(false)} />}
  </>
}
