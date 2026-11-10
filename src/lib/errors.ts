const messages: Record<string, string> = {
  PC_FORBIDDEN: 'Você não tem permissão para esta operação.',
  PC_UNAUTHENTICATED: 'Sua sessão terminou. Entre novamente.',
  PC_NOT_CONFIGURED: 'Configure a conexão com o Supabase para continuar.',
  PC_ALREADY_MEMBER: 'Este usuário já participa da campanha.',
  PC_INVITE_LIMIT: 'A campanha já possui 20 convites pendentes. Revogue um para continuar.',
  PC_INVITE_EXPIRED: 'Este convite expirou ou já foi respondido.',
  PC_ARCHIVED: 'Reative a campanha antes de convidar ou adicionar participantes.',
  PC_MEMBER_NOT_FOUND: 'O participante não está mais disponível ou é o mestre.',
  invalid_credentials: 'Usuário ou senha incorretos.',
  PC_INVALID_USERNAME: 'Use de 3 a 32 letras, números, pontos, traços ou sublinhados no usuário.',
  PC_USERNAME_TAKEN: 'Este usuário já está em uso. Escolha outro.',
  PC_USERNAME_NOT_FOUND: 'Usuário não encontrado. O participante precisa criar sua conta primeiro.',
  PC_TOO_MANY_ATTEMPTS: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  PC_INVALID_INPUT: 'Confira o usuário e a senha informados.',
  PC_AUTH_UNAVAILABLE: 'Não foi possível acessar sua conta agora. Tente novamente.',
  user_already_exists: 'Não foi possível criar a conta. Confira seu usuário ou tente entrar.',
  over_email_send_rate_limit: 'Muitas solicitações de e-mail. Aguarde alguns minutos.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos.',
  same_password: 'Escolha uma senha diferente da anterior.',
  weak_password: 'Use uma senha com pelo menos 8 caracteres.',
  '23505': 'Já existe um convite pendente para este usuário.',
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
