export function campaignInput(name: string, description: string) {
  const clean = { name: name.trim(), description: description.trim() }
  if (clean.name.length < 3 || clean.name.length > 80) throw new Error('O nome deve ter de 3 a 80 caracteres.')
  if (clean.description.length > 2000) throw new Error('A descrição pode ter até 2.000 caracteres.')
  return clean
}
export function isHttpsUrl(value: string) {
  if (!value) return true
  try { return value.length <= 2048 && new URL(value).protocol === 'https:' } catch { return false }
}
export function initials(name: string) {
  return name.trim().split(/\s+/u).slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase('pt-BR') || 'PC'
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}
export function safeReturnPath(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && !/[\r\n]/.test(value) ? value : '/'
}
