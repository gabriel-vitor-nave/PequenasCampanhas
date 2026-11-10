import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import type { Campaign } from '../../types/database'

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { user } = useAuth()
  return <article className="campaign-card"><div className="campaign-card-body"><Link to={`/campanhas/${campaign.id}`}><h3>{campaign.name}</h3></Link><span className="help-text">{campaign.owner_id === user?.id ? 'Mestre' : 'Jogador'} · {campaign.status === 'active' ? 'Em andamento' : 'Arquivada'}</span></div><div className="campaign-row-actions"><Link className="button button-secondary" to={`/campanhas/${campaign.id}`}>Campanha</Link><Link className="button button-primary" to={`/campanhas/${campaign.id}/mesa`}>Abrir mesa</Link></div></article>
}
