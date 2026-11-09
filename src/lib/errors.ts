const messages: Record<string, string> = {
  PC_FORBIDDEN: 'Você não tem permissão para esta operação.',
  PC_UNAUTHENTICATED: 'Sua sessão terminou. Entre novamente.',
  PC_NOT_CONFIGURED: 'Configure a conexão com o Supabase para continuar.',
  PC_ALREADY_MEMBER: 'Este e-mail já participa da campanha.',
  PC_INVITE_LIMIT: 'A campanha já possui 20 convites pendentes. Revogue um para continuar.',
  PC_INVITE_EXPIRED: 'Este convite expirou ou já foi respondido.',
  PC_ARCHIVED: 'Reative a campanha antes de convidar ou adicionar participantes.',
  PC_MEMBER_NOT_FOUND: 'O participante não está mais disponível ou é o mestre.',
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar.',
  user_already_exists: 'Não foi possível criar a conta. Confira seu e-mail ou tente entrar.',
  over_email_send_rate_limit: 'Muitas solicitações de e-mail. Aguarde alguns minutos.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos.',
  same_password: 'Escolha uma senha diferente da anterior.',
  weak_password: 'Use uma senha com pelo menos 12 caracteres.',
  '23505': 'Já existe um convite pendente para este e-mail.',
  '23514': 'Confira os campos e os limites indicados.',
}
export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const code = 'code' in error ? String(error.code) : ''
    const message = 'message' in error ? String(error.message) : ''
    if (messages[code]) return messages[code]
    for (const [key, value] of Object.entries(messages)) if (message === key) return value
    if (/fetch|network|offline/i.test(message)) return 'Falha de conexão. Confira sua internet e tente novamente.'
  }
  return 'Não foi possível concluir. Tente novamente. Se persistir, contate o administrador.'
}
