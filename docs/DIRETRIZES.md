# Pequenas Campanhas — Diretrizes de desenvolvimento

## 1. Objetivo

Transformar o Pequenas Campanhas em uma plataforma funcional de RPG de mesa online, com foco absoluto no **tabletop**.

Não quero uma landing page elaborada, textos promocionais, dashboards cheios de cartões ou uma interface que parece gerada automaticamente por IA.

Quero uma ferramenta prática para um mestre e seus jogadores utilizarem durante sessões reais.

**O mestre deve conseguir preparar, editar e controlar praticamente tudo dentro da mesa.**

O projeto já possui autenticação por usuário e senha e gerenciamento de campanhas. Preserve o que funciona e desenvolva a mesa jogável integrada às campanhas existentes.

O primeiro sistema suportado será D&D 5e 2024, mas o tabletop não deve depender exclusivamente das regras desse sistema.

A plataforma será utilizada inicialmente em computadores. Não é necessário implementar uma interface mobile agora.

## 2. Interface — eliminar o AI slop

A interface atual precisa ser simplificada.

**Remover:**
- O verde atualmente utilizado como identidade visual predominante.
- Gradientes desnecessários, brilhos, efeitos exagerados e sombras pesadas.
- Cartões enormes, bordas arredondadas em excesso e espaços vazios artificiais.
- Textos promocionais, slogans e descrições redundantes.
- Ícones decorativos, emojis desnecessários e informações duplicadas.
- Modais para ações que podem ser realizadas diretamente na mesa.

**Adotar:**
- Visual sóbrio, minimalista e funcional.
- Fundo grafite e painéis em cinza-escuro.
- Textos em branco e cinza-claro.
- Azul discreto para seleção e ações importantes.
- Bordas finas, ícones simples e botões compactos.
- Painéis redimensionáveis e recolhíveis.
- Menus de contexto com clique direito.
- Atalhos de teclado para ferramentas frequentes.

O espaço deve ser utilizado de maneira inteligente.

### Layout do tabletop

**Barra superior compacta:**
Nome da campanha, cena atual, jogadores conectados, salvar/sincronização e configurações.

**Barra lateral esquerda:**
Selecionar, mover, régua, desenhos, texto, borracha, névoa de guerra e demais ferramentas do mapa.

**Área central:**
Mapa interativo ocupando aproximadamente 75–85% da área disponível quando os painéis estiverem recolhidos.

**Painel lateral direito:**
Abas para tokens, cenas, combate, fichas, diário, biblioteca e configurações.

**Área inferior discreta:**
Rolador de dados, histórico de rolagens e controles de áudio.

Os painéis devem abrir somente quando necessários. A mesa deve continuar utilizável com todos eles fechados.

Nada de grandes títulos como "Sua aventura começa aqui". Mostrar diretamente as ferramentas.

## 3. Mapas, grid e câmera

O mestre pode:

- Fazer upload de imagens JPG, PNG e WebP.
- Utilizar qualquer imagem como mapa.
- Redimensionar, posicionar, substituir e remover mapas.
- Ativar ou desativar o grid.
- Configurar grid quadrado ou hexagonal.
- Ajustar o tamanho das células.
- Ajustar o alinhamento do grid em relação à imagem.
- Definir escala e unidades de distância.
- Configurar transparência e cor das linhas.
- Bloquear o mapa para evitar movimentações acidentais.
- Criar várias cenas e alternar entre elas.

Todos podem aproximar, afastar, arrastar e centralizar a câmera. A visão individual não deve ser alterada quando outro jogador movimentar a própria câmera.

O mestre pode, quando desejar, enviar os jogadores para uma posição ou cena específica.

### Ferramentas adicionais

- Régua para medir distâncias.
- Indicador de área de movimento.
- Templates de círculo, cone, linha, cubo e esfera projetada no mapa.
- Marcadores e pings para chamar a atenção.
- Névoa de guerra com revelar e ocultar regiões.
- Camadas independentes para mapa, tokens, desenhos e informações privadas.
- Ferramentas de alinhamento e snap ao grid.

## 4. Tokens

Qualquer imagem enviada pelo mestre pode se tornar um token.

Funcionalidades:

- Upload de imagem personalizada.
- Token circular, quadrado ou sem moldura.
- Nome e imagem.
- Tamanho configurável no grid.
- Vida atual e máxima.
- Barra de vida opcional.
- Classe de armadura.
- Condições e marcadores.
- Visibilidade para jogadores.
- Vinculação a uma ficha de personagem ou criatura.
- Controle individual ou compartilhado.
- Duplicar, copiar, colar e excluir.
- Bloquear posição.
- Ajustar ordem de sobreposição.
- Mover livremente ou encaixar nas células.
- Movimentação coletiva de múltiplos tokens.
- Anotações privadas do mestre.
- Auras e indicadores de alcance.

O mestre pode manipular todos os tokens. O jogador só pode mover aqueles para os quais recebeu permissão.

O menu de contexto do token deve oferecer ações como **Editar, Duplicar, Ocultar, Adicionar ao combate e Excluir**.

## 5. Ferramentas de desenho

Quero poder desenhar livremente sobre os mapas, como em um editor simples.

Ferramentas:

- Lápis.
- Linha.
- Retângulo.
- Círculo.
- Seta.
- Texto.
- Borracha.
- Seleção e movimentação.
- Cores personalizadas.
- Espessura e transparência.
- Desfazer e refazer.
- Apagar desenhos selecionados.
- Limpar camada com confirmação.

Os desenhos precisam ser persistentes e sincronizados entre os participantes autorizados.

Também deve existir uma camada privada do mestre.

## 6. Dados e rolagens

Implementar um sistema completo de rolagem de dados.

Dados comuns: d4, d6, d8, d10, d12, d20 e d100.

Permitir expressões como:

- `1d20+5`
- `2d6+3`
- `4d8+2`
- `2d20kh1`
- `2d20kl1`

Implementar vantagem, desvantagem, modificadores, rolagens privadas do mestre, rolagens públicas e histórico compartilhado.

Os resultados oficiais devem ser calculados no servidor, gerando um único registro persistente por rolagem. Não calcular resultados independentes em cada navegador.

A ficha deve permitir clicar em um atributo, perícia, ataque ou magia para executar a rolagem correspondente.

## 7. Gerenciador de combate

Painel compacto para conduzir encontros.

- Adicionar ou remover combatentes.
- Rolar iniciativa.
- Definir iniciativa manualmente.
- Ordenar participantes.
- Próximo turno e turno anterior.
- Contador de rodadas.
- Pontos de vida e vida temporária.
- Dano e cura.
- Condições.
- Concentração.
- Marcador visual do personagem ativo.
- Rolagens rápidas.
- Visibilidade de informações controlada pelo mestre.

O combate deve ser associado aos tokens existentes na mesa.

Não quero uma tela separada que interrompa a sessão. O combate deve funcionar em um painel lateral.

## 8. Fichas de personagem — D&D 5e 2024

Criar fichas editáveis com:

- Nome, classe, espécie, antecedentes e nível.
- Atributos e modificadores.
- Bônus de proficiência.
- Testes de resistência.
- Perícias.
- Classe de armadura.
- Iniciativa e deslocamento.
- Pontos de vida e dados de vida.
- Ataques e equipamentos.
- Inventário e moedas.
- Habilidades e características.
- Magias e espaços de magia.
- Recursos limitados e descansos.
- Condições e anotações.
- Retrato e token associado.

Sempre que possível, oferecer botões para automatizar ações durante a sessão, sem impedir a edição manual.

O mestre pode editar fichas e criaturas. Jogadores podem editar as próprias fichas conforme as permissões concedidas.

As regras automatizadas devem seguir o conteúdo legalmente disponível para implementação, permitindo cadastro manual de conteúdo adicional.

## 9. Painel do mestre

O mestre precisa de ferramentas para organizar a campanha:

- NPCs.
- Monstros e criaturas personalizadas.
- Encontros preparados.
- Missões.
- Facções.
- Locais.
- Notas e segredos.
- Diário da campanha.
- Inventários e recompensas.
- Handouts e imagens compartilháveis.
- Biblioteca de mapas e tokens.
- Cenas preparadas antecipadamente.

O mestre poderá criar, editar, duplicar, reorganizar e excluir os conteúdos.

Cada item deve possuir controles claros de visibilidade: privado do mestre, compartilhado com determinados jogadores ou público para a campanha.

**Conteúdo privado não pode ser enviado ao navegador dos jogadores**, mesmo que esteja visualmente oculto.

## 10. Música e efeitos sonoros

A comunicação de voz será feita exclusivamente pelo Discord.

Não implementar chamada de voz ou vídeo dentro do Pequenas Campanhas.

Entretanto, quero um **sistema de áudio integrado à mesa**, controlado principalmente pelo mestre.

### Upload de áudio

O mestre pode enviar arquivos de música e efeitos sonoros próprios, organizando-os em uma biblioteca.

### Música

- Reproduzir e pausar.
- Volume individual para cada jogador.
- Volume principal do mestre.
- Loop.
- Playlists.
- Fila de músicas.
- Troca de faixa.
- Fade-in e fade-out.
- Reproduzir música para todos na sessão.
- Associar trilhas às cenas.

### SFX

- Botões de reprodução rápida.
- Biblioteca de efeitos.
- Sons curtos e ambientes contínuos.
- Reproduzir para toda a mesa ou somente localmente.
- Acionar sons durante eventos.
- Interromper sons em reprodução.
- Permitir vários efeitos simultâneos.
- Controle individual de volume.

A reprodução compartilhada deve sincronizar o comando e a posição da faixa entre os participantes, respeitando as limitações e permissões de reprodução dos navegadores.

Não transmitir o áudio pelo Discord: os jogadores escutam diretamente pelo site.

## 11. Sincronização em tempo real

A mesa deve representar um estado compartilhado, persistente e confiável.

Ao mover um token, os demais participantes autorizados devem ver sua nova posição.

O mesmo vale para:

- Desenhos.
- Tokens.
- Alterações de vida.
- Combate.
- Rolagens.
- Cenas.
- Notas compartilhadas.
- Música sincronizada.

Utilizar Supabase Realtime e persistência no banco de dados, com controle de acesso adequado.

Cada ação persistente deve ter identificador próprio e proteção contra duplicações. Ao reconectar, o cliente deve recuperar o estado salvo e reconciliar alterações.

As permissões devem ser verificadas no servidor, não apenas nos componentes React.

Criar políticas RLS adequadas para campanhas, participantes, cenas, arquivos e conteúdos privados.

## 12. Organização e qualidade de uso

Também quero:

- Biblioteca de arquivos reutilizáveis.
- Busca por tokens e recursos.
- Duplicação de cenas.
- Atalhos de teclado.
- Configurações por usuário.
- Salvamento automático.
- Indicadores discretos de conexão e sincronização.
- Recuperação após desconexões.
- Confirmações para ações destrutivas.
- Exportação de dados da campanha.
- Histórico básico de alterações importantes.
- Tratamento claro de erros.
- Bom desempenho com vários tokens e desenhos.

Evitar animações desnecessárias e interfaces pesadas.

## 13. Tecnologias e integração

Preservar a base existente:

- React.
- TypeScript.
- Vite.
- PixiJS para renderização do tabletop.
- Supabase Auth, PostgreSQL, Storage e Realtime.
- Repositório GitHub como fonte das alterações.
- Publicação atual no ChatGPT Sites.

**Autenticação exclusivamente por nome de usuário e senha.** Não adicionar login social, login por Google ou telas solicitando e-mail. Implementar a autenticação de forma compatível e segura com o Supabase Auth.

Não migrar para Vercel agora.

Não recriar telas, funcionalidades ou estruturas que já funcionam sem necessidade.

## 14. Ordem de implementação

**Primeira entrega — mesa realmente jogável**

1. Abrir mesa a partir de uma campanha.
2. Upload e exibição de mapa.
3. Grid configurável, zoom e movimentação da câmera.
4. Criação e movimentação de tokens com permissões.
5. Desenhos compartilhados.
6. Rolagem de dados.
7. Combate básico com iniciativa e vida.
8. Sincronização em tempo real.
9. Persistência de todas as alterações.
10. Upload e reprodução básica de músicas e SFX.
11. Interface compacta e funcional.

**Segunda entrega — ferramentas avançadas**

Fichas completas, régua, templates de área, névoa de guerra, biblioteca de NPCs, encontros, diário, camadas avançadas e controles adicionais de visibilidade.

**Terceira entrega — aprimoramentos**

Automatizações de regras, macros, playlists avançadas, efeitos vinculados a eventos e ferramentas adicionais de preparação de sessões.

## 15. Critério de conclusão

A primeira entrega só estará concluída quando este cenário funcionar de verdade:

O mestre cria ou abre uma campanha, entra na mesa, envia uma imagem, configura o grid e adiciona tokens.

Um jogador acessa a mesma mesa em outro computador, vê o mapa, movimenta o token autorizado, desenha e rola dados.

O mestre acompanha as alterações em tempo real, inicia um combate e reproduz um efeito sonoro ou música para o grupo.

Ambos atualizam a página e encontram o estado da mesa preservado.

**Não substituir funcionalidades reais por botões decorativos, dados simulados ou interfaces que apenas aparentam funcionar.**

A prioridade é construir um tabletop simples, eficiente, estável, totalmente editável pelo mestre e realmente utilizável durante uma sessão de RPG.