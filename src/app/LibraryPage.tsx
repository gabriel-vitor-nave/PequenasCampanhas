import { BookOpen, ScrollText, UsersRound } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '../components/ui/primitives'
export function LibraryPage() {
  return <><div className="page-heading"><div><div className="eyebrow">REFERÊNCIAS PARA NOVOS MUNDOS</div><h1>Biblioteca<span className="heading-dot">.</span></h1><p>Um espaço que vai crescer com as suas aventuras.</p></div><Badge>Em desenvolvimento</Badge></div><section className="panel library-intro"><BookOpen size={37} strokeWidth={1.2} /><h2>Conhecimento para levar à mesa.</h2><p>As bibliotecas pesquisáveis ainda não estão disponíveis nesta entrega. A implementação seguirá o conteúdo do SRD aplicável e os registros criados pelos usuários.</p><div className="library-roadmap"><div><ScrollText size={21} /><strong>Magias e habilidades</strong><span>Fase 3 · Sistema de RPG</span></div><div><UsersRound size={21} /><strong>Monstros e NPCs</strong><span>Fase 4 · Painel do mestre</span></div></div><Link to="/campanhas" className="text-link">Organizar minhas campanhas →</Link></section></>
}
