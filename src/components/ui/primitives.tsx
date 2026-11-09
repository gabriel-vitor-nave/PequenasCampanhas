import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AlertCircle, LoaderCircle, X } from 'lucide-react'
import { errorMessage } from '../../lib/errors'

export function Button({ variant = 'primary', busy, children, className = '', disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; busy?: boolean }) {
  return <button className={`button button-${variant} ${className}`} disabled={busy || disabled} aria-busy={busy || undefined} {...props}>{busy && <LoaderCircle size={16} className="spin" />}{children}</button>
}
export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null
  return <div className="notice notice-error" role="alert"><AlertCircle size={18} /><span>{errorMessage(error)}</span></div>
}
export function Notice({ children }: { children: ReactNode }) { return <div className="notice" role="status">{children}</div> }
export function Loading({ label = 'Carregando…' }: { label?: string }) { return <div className="loading" role="status"><LoaderCircle className="spin" size={22} /> {label}</div> }
export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'gold' | 'green' }) { return <span className={`badge badge-${tone}`}>{children}</span> }
export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><h2>{title}</h2><p>{children}</p>{action}</div>
}
export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close() }, [])
  return <dialog ref={ref} className="dialog" aria-labelledby="dialog-title" onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dialog-heading"><h2 id="dialog-title">{title}</h2><Button variant="ghost" onClick={onClose} aria-label="Fechar janela"><X size={19} /></Button></div>{children}
  </dialog>
}
