import { Hexagon } from 'lucide-react'
export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="brand"><span className="brand-symbol"><Hexagon size={29} strokeWidth={1.5} /><span>p</span></span>{!compact && <span>pequenas<strong>campanhas</strong></span>}</span>
}
