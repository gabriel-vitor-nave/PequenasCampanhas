import { Link } from 'react-router'
import { ArrowUpRight, BookOpen, Compass } from 'lucide-react'
import { Badge } from '../../components/ui/primitives'
import { dateLabel } from '../../lib/validation'
import { useAuth } from '../auth/AuthProvider'
import type { Campaign } from '../../types/database'

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const { user } = useAuth()
  return <Link to={`/campanhas/${campaign.id}`} className="campaign-card"><div className="campaign-cover" aria-hidden="true"><Compass size={76} strokeWidth={0.7} /><span className="cover-line" /><span className="cover-caption">PEQUENAS CAMPANHAS</span></div><div className="campaign-card-body"><div className="card-meta"><Badge tone={campaign.status === 'active' ? 'green' : 'muted'}>{campaign.status === 'active' ? 'Em andamento' : 'Arquivada'}</Badge><span>{campaign.owner_id === user?.id ? 'Mestre' : 'Jogador'}</span></div><h3>{campaign.name}<ArrowUpRight size={18} /></h3><p>{campaign.description || 'Uma história esperando pelo próximo capítulo.'}</p><div className="card-footer"><span><BookOpen size={14} />D&D 5e · 2024</span><span>{dateLabel(campaign.updated_at)}</span></div></div></Link>
}
