# Usuário e senha — 9 de novembro de 2026

Por solicitação explícita do usuário, o acesso foi alterado para **somente usuário e senha**. Login e cadastro têm dois campos. O cadastro instala a sessão imediatamente. Perfil, navegação e convites exibem nomes de usuário. Rotas e telas de confirmação/recuperação por e-mail foram removidas.

## Implementação

- `shared/credentials.ts`: normalização e validação única no navegador/servidor.
- `supabase/functions/account-access`: valida a chave pública do aplicativo e as credenciais. Registro usa Auth Admin apenas no servidor, com identificador interno UUID em domínio `.invalid`; nenhum endereço de contato é pedido ou verificado.
- As senhas são processadas pelo Supabase Auth. O handler não armazena nem registra senhas ou tokens e devolve apenas os tokens da sessão correspondente.
- `profiles.username` é único, normalizado e não pode ser alterado pelo cliente. Nome de exibição continua editável.
- Limites persistentes: 300 acessos/10 minutos globais, 40/10 minutos por origem de rede derivada, 30 registros/hora globais e 10/hora por origem de rede. Identificadores de rede recebem hash com segredo do servidor; cabeçalhos de rede não são a única defesa. Registros vencidos são removidos após 24 horas.
- Origem CORS limitada ao Site e aos endereços locais de desenvolvimento. Requisições têm tamanho máximo de 4 KB. Erros não expõem detalhes administrativos.
- `verify_jwt=false` é exclusivo desta entrada pública de senha, que faz autenticação própria; não desativa JWT/RLS para os dados de campanhas.
- Convites são feitos por usuário e vinculados ao ID imutável da conta. Trocar o identificador interno não perde convites antigos. O RPC antigo de convidar por e-mail foi revogado.

## Conta existente

A migração atribuiu `kbum` à conta existente sem alterar sua senha ou ID. A conversão para identificador interno acontece somente depois de uma senha válida. Para a conta antiga ainda sem confirmação, uma função privada compara a senha com o hash bcrypt nativo e retorna apenas um booleano. Somente o papel de servidor pode chamar essa verificação; `anon` e `authenticated` não podem.

Após essa prova, o servidor atualiza a conta usando a API administrativa do Auth e abre uma sessão normal. Nenhuma confirmação de contato real é simulada: o identificador passa a ser interno, não entregável e não exibido. Não foram removidos usuários nem participações reais.

## Validação

30 testes locais aprovados: formulários, handler, limites, duplicação, credenciais inválidas, conversão condicionada à senha, migrações e RLS. Build TypeScript/Vite aprovado. Verificação hospedada passou para cadastro sem e-mail, sessão imediata, perfil, senha incorreta rejeitada, nome duplicado rejeitado e novo login.

Uma transação hospedada confirmou bcrypt válido/inválido para uma conta legada temporária e reverteu o fixture. O teste de navegador completo executa cadastro, logout e novo login com uma conta descartável. As contas de teste são removidas ao fim da verificação, preservando `kbum`.

## Limites atuais

Não há recuperação automática de senha nesta entrega. Não substituir isso por redefinição sem prova de identidade. Recursos de senha comprometida do provedor ainda não estão configurados; a tabela privada do limitador tem RLS sem políticas para clientes intencionalmente. A mesa virtual continua na próxima fase do plano.
