# Design System — CodeLive

Referência de identidade visual do CodeLive. Combina a atmosfera escura e imersiva de
colaboração do **kosmi.io** com a clareza e o foco em código do **onlinegdb.com**, usando os
tokens verificados do skill `ui-ux-pro-max` (estilo _Dark Mode / OLED_, "code dark + run green").

> Fonte da verdade dos tokens: `frontend/tailwind.config.js`. Componentes usam apenas classes
> semânticas do Tailwind; nunca hexadecimais espalhados pelo código.

## 1. Princípios

- **Código em primeiro lugar:** contraste alto, tipografia monoespaçada para código e códigos de
  acesso, sem ruído visual.
- **Escuro por padrão:** fundo OLED, emissão baixa de branco, conforto para sessões longas.
- **Um acento:** verde de "executar" (OnlineGDB) como única cor de ação; o resto é neutro.
- **Acessível por padrão:** foco visível, alvos de 44×44 px, contraste mínimo 4.5:1.
- **Movimento com propósito:** transições de 150–300 ms, respeitando `prefers-reduced-motion`.

## 2. Cores

| Papel                 | Token Tailwind           | Hex       | Uso                                    |
| --------------------- | ------------------------ | --------- | -------------------------------------- |
| Fundo                 | `bg-background`          | `#0F172A` | Fundo da aplicação                     |
| Texto                 | `text-foreground`        | `#F8FAFC` | Texto principal                        |
| Superfície / card     | `bg-surface`             | `#1B2336` | Cards, toolbars, modais                |
| Borda                 | `border-border`          | `#475569` | Divisórias e contornos                 |
| Primária (estrutural) | `bg-primary`             | `#1E293B` | Botões neutros e cabeçalhos            |
| Secundária            | `bg-secondary`           | `#334155` | Estados intermediários                 |
| Acento / CTA          | `bg-accent`              | `#22C55E` | Ação principal, foco, status "ao vivo" |
| Texto sobre acento    | `text-accent-foreground` | `#0F172A` | Texto em botões verdes                 |
| Muted                 | `bg-muted`               | `#272F42` | Fundos discretos                       |
| Texto muted           | `text-muted-foreground`  | `#94A3B8` | Apoio, placeholders, legendas          |
| Destrutivo            | `bg-destructive`         | `#EF4444` | Erros e ações destrutivas              |
| Anel de foco          | `ring-ring`              | `#FFFFFF` | `focus-visible`                        |

Regras:

- Não usar cores de estado apenas por cor; acompanhar de texto ou ícone.
- Verde é ação/estado positivo, nunca decoração.
- Contraste mínimo 4.5:1 para texto; 3:1 para elementos de interface.

## 3. Tipografia

| Uso                      | Fonte              | Classes     |
| ------------------------ | ------------------ | ----------- |
| Corpo, labels, navegação | **IBM Plex Sans**  | `font-sans` |
| Títulos, código, códigos | **JetBrains Mono** | `font-mono` |

- Corpo base: 16 px, `line-height: 1.5`.
- Títulos: `font-mono`, `font-semibold`, `tracking-tight`.
- Código e códigos de acesso: `font-mono`, `tracking-[0.2em]`, `uppercase` quando aplicável.
- Nunca texto de corpo abaixo de 12 px.

## 4. Espaçamento, forma e elevação

- Escala padrão de 16–64 px; áreas densas (dashboard/editor) podem usar 8–32 px.
- Alvos de toque/clique: mínimo **44×44 px**, com 8 px de separação.
- Raio: `rounded-lg` (8 px) para controles, `rounded-xl` (12 px) para cards.
- Elevação: usar `border border-border` + `bg-surface`; evitar sombras pesadas.
- Glow de acento apenas em foco/estado ativo: `shadow-glow`.

## 5. Movimento

- Hover/foco: 150–200 ms; entrada de painéis: 200–300 ms.
- Não animar `width`/`height`; preferir `opacity`/`transform`.
- `prefers-reduced-motion` desliga animações (já aplicado em `src/index.css`).

## 6. Componentes

### 6.1 LanguageSelector (#19)

- Seleciona a **linguagem de programação** da sala: Python, Java, C, PHP e JavaScript (RF08).
- Implementação: `<select>` nativo estilizado em `features/rooms/components/LanguageSelector.tsx`
  — acessível por teclado e leitor de tela, sem ícone decorativo.
- Rótulo visível associado ao controle.
- Altura mínima 44 px, borda `border-border`, fundo `bg-surface`, foco `ring-ring`.
- Estado desabilitado com `opacity-50` e `cursor-not-allowed`.

### 6.2 AccessCode (#19)

Código de acesso de **6 caracteres**, maiúsculos, sem ambíguos
(`A–Z` sem `I/O` + dígitos `2–9`, alinhado ao alfabeto do backend em
`backend/app/features/rooms/service.py`), por exemplo `K7M2QX`.
Implementação em `features/rooms/components/AccessCode.tsx` + `features/rooms/accessCode.ts`.

- **Modo display (dono):** código em `font-mono`, `tracking-[0.2em]`, botão "Copiar" com feedback
  visual e `aria-live="polite"` ("Copiado!"). Fallback sem Clipboard API: selecionar o texto e
  orientar a cópia manual.
- **Modo input (espectador):** campo único, `inputMode="text"`, `autoComplete="one-time-code"`,
  normalização para maiúsculas e limite de 6 caracteres; mensagem de erro junto ao campo.
- Rótulo visível, texto de apoio e foco visível.
- Nunca usar apenas placeholder como rótulo.

### 6.3 Botões e foco

- Primário: `bg-accent text-accent-foreground hover:brightness-110`.
- Secundário: `bg-surface border border-border text-foreground`.
- Foco sempre visível (`ring-2 ring-ring ring-offset-2 ring-offset-background`).
- Ícones em SVG (Lucide/Heroicons), nunca emoji.

### 6.4 Autenticação: cadastro, login e sessão (#10, #11)

`AuthLayout` é o shell de login e registro: painel de marca (oculto abaixo de `lg`) + área de
formulário centralizada (`max-w-md`). As páginas (`app/pages/LoginPage.tsx` e `RegisterPage.tsx`)
são apresentacionais e recebem `onSubmit`; a composição com a API vive em
`app/routes/LoginRoute.tsx` e `app/routes/RegisterRoute.tsx`, e as chamadas HTTP em
`features/auth/api.ts`.

- **Sessão:** o token é um cookie `httpOnly`, `Secure`, `SameSite=Lax` definido pelo backend. O
  front nunca o lê nem o guarda; `GET /api/auth/me` alimenta o `AuthProvider`, então recarregar a
  página ou abrir outra aba mantém o estado. Nunca usar `localStorage`.
- **Rotas:** `ProtectedRoute` bloqueia `/rooms/*` e envia para `/login` guardando o destino em
  `location.state.from` (apenas caminho interno). `GuestRoute` manda usuário autenticado para
  `/rooms`. Enquanto a sessão é desconhecida, as rotas mostram `role="status"` ("Carregando…") e
  nunca renderizam conteúdo privado.
- **Falha de sessão:** erro que não é 401 (rede, 5xx) vira estado `error` com `role="alert"` e botão
  "Tentar novamente" — não derruba o usuário para o login.
- **Validação:** espelha o backend (nome ≤ 120, senha entre 8 e 128, e-mail com formato válido).
  Cada campo inválido recebe `error` no `TextField`, foco no primeiro inválido ao enviar, e o erro
  some ao digitar. `validation_error` do backend é exibido como veio.
- **Erro de API:** `role="alert"` com `text-destructive` acima do botão. `invalid_credentials` →
  "E-mail ou senha incorretos."; `email_already_exists` → "Este e-mail já está cadastrado."; falha
  de rede → "Não foi possível conectar ao servidor. Tente novamente." (ver
  `features/auth/messages.ts`).
- **Carregamento:** o botão de envio entra em `isLoading` → `aria-busy="true"`, `disabled`, rótulo
  "Entrando…"/"Criando conta…" e `Spinner`; os campos ficam `disabled` durante o envio e o estado
  volta ao normal no `finally`.
- **Logout:** botão "Sair" no `AppShell`, sempre visível, com `min-h-11`; mostra "Saindo…" e
  spinner durante a chamada e, se falhar, exibe `role="alert"` sem encerrar a sessão local.
- **Rota:** `/` redireciona para `/login`; `/register` fica no mesmo layout. Rotas são lazy com
  fallback `role="status"` ("Carregando…").
- **Alvos:** botão e campos com `min-h-11` (44 px).
- **Foco:** anel global `focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background` em
  `src/index.css`; campos e botões herdam o mesmo tratamento. Ordem de tabulação = ordem visual,
  sem `tabIndex` positivo.

### 6.5 Editor de código (#33)

- CodeMirror 6 em `features/live_code`, carregado sob demanda: o componente entra por code splitting e
  cada linguagem é importada dinamicamente (`import()`), nunca no bundle inicial.
- Tipografia JetBrains Mono 14 px, fundo `bg-surface`, gutter `bg-background`, cursor e seleção em
  `accent`.
- **Dono:** editor editável (`EditorView.editable` = `true`) com `onChange`.
- **Espectador:** somente leitura (`EditorState.readOnly` + `EditorView.editable` = `false` +
  `aria-readonly="true"`). A interface não é a autoridade: o servidor aplica RF13/RNF01.
- Foco visível: anel branco (`ring`) em `.cm-focused`.
- Sem quebra de linha: rolagem horizontal e vertical; altura mínima de 16 rem.
- Sintaxe: extensões oficiais para Python, Java, C (`lang-cpp`), PHP e JavaScript, com
  `HighlightStyle` próprio.
- Sincronização externa (`snapshot`/`code_update`): aplica apenas o trecho que difere
  (prefixo/sufixo comum preservados), mantendo cursor e seleção fora do trecho alterado.
- `Tab` não é capturado pelo editor, preservando a navegação por teclado.
- Exceção de token: as cores exigidas pelo CodeMirror ficam centralizadas em
  `features/live_code/editorTheme.ts`; o restante da interface usa apenas tokens Tailwind.

### 6.6 Espectador ao vivo (#34)

- O editor do espectador é **sempre somente leitura** (`CodeEditor readOnly`). O bloqueio é de
  interface; o servidor continua sendo a autoridade (RF06/RNF01).
- Aviso textual fixo: "Você está assistindo. Somente o dono da sala pode editar o código." —
  nunca depender apenas da cor ou do atributo `contenteditable`.
- Indicador de conexão em `features/live_code/components/ConnectionStatus.tsx`, com
  `role="status"` + `aria-live="polite"` (não interrompe quem está lendo):
  - **Conectando…** — primeira tentativa em andamento (`text-muted-foreground`).
  - **Conectado** — ponto `accent`.
  - **Reconectando…** — queda depois de já ter conectado (`text-muted-foreground`, pulso
    `motion-safe:animate-pulse`).
  - **Sem conexão** — a primeira tentativa falhou e o cliente continua tentando
    (`text-destructive`).
- Reconexão automática: backoff exponencial de 1 s, 2 s, 4 s com teto de 8 s + jitter de até
  300 ms; tentativas ilimitadas enquanto a página estiver aberta.
- Durante a queda o último código recebido permanece visível; o `snapshot` seguinte atualiza o
  documento sem resetar o cursor (RNF04).
- Cada frame recebido é registrado em log estruturado com `timestamp`, `request_id` e
  `content_hash` (quando presente), para comparar estados.
- Contagem de participantes com `aria-live="polite"` e plural/singular corretos.
- Animação apenas com `motion-safe:`; `prefers-reduced-motion` desliga o pulso.

### 6.7 Tela "Minhas salas" (#17)

Rota `/rooms`, composta por `app/routes/RoomListRoute.tsx` (auth + API + cache) e
`app/pages/RoomListPage.tsx` (apresentação). Lista apenas as salas do dono, mais recente primeiro,
com as abas da §6.12 no topo ("Criadas por mim" / "Participei").

- **Card de sala** (`features/rooms/components/RoomCard.tsx`): código como título
  (`font-mono`, `tracking`, `select-all`), `StatusBadge` com texto ("Aberta"/"Encerrada"),
  linguagem e data de criação. Ações em ordem visual e com nomes acessíveis que incluem o código
  (`sr-only`):
  1. "Abrir sala" (link, `bg-surface`);
  2. "Copiar" (secundário) — sempre disponível;
  3. "Regenerar" (secundário) — apenas sala aberta;
  4. "Encerrar" (destrutivo) — apenas sala aberta.
     Alvos ≥ 44 px, `gap-2` e quebra de linha no mobile.
- **Copiar código:** `navigator.clipboard.writeText`; sucesso anuncia "Copiado!" em
  `role="status" aria-live="polite"`. Sem Clipboard API ou com permissão negada, mostra
  "Não foi possível copiar. Selecione o código e copie manualmente." e o código continua
  selecionável.
- **Criar sala:** o botão "Nova sala" (header) e o "Criar sala" (estado vazio) abrem o mesmo
  diálogo, com `LanguageSelector` (Python padrão), descrição do código automático, "Criar sala" e
  "Cancelar". Durante o envio o botão fica `aria-busy`/"Criando…", tudo é desabilitado e ESC/
  backdrop não fecham. Falha mantém o diálogo aberto com `role="alert"`; sucesso fecha e anuncia
  "Sala criada. Código de acesso X.".
- **Encerrar (confirmação):** título "Encerrar sala K7M2QX?", aviso de que a sala não reabre,
  confirmação na variante destrutiva "Encerrar sala". Sucesso troca o badge para "Encerrada",
  remove "Regenerar"/"Encerrar" e anuncia "Sala K7M2QX encerrada.".
- **Regenerar (confirmação):** título "Regenerar código de acesso?", aviso de que o código
  anterior deixa de funcionar, confirmação primária "Regenerar código". Sucesso exibe o novo
  código e anuncia "Novo código de acesso: X. O código anterior não funciona mais.".
- **Botão destrutivo:** `bg-destructive` com texto escuro (`text-accent-foreground`, ≈ 4.5:1).
  A ação nunca é indicada só pela cor; o rótulo diz o que acontece.
- **Diálogos** (`Dialog`/`ConfirmDialog`/`CreateRoomDialog`): `role="dialog"`,
  `aria-modal="true"`, `aria-labelledby`/`aria-describedby`, foco inicial em "Cancelar", `Tab`
  preso ao diálogo, ESC/backdrop fecham quando não há envio em andamento e o foco volta ao
  gatilho (ou ao título da página quando a ação some, como em "Encerrar").
- **Estados:** carregando (`role="status"` "Carregando salas…" mantendo o header), vazio
  (`EmptyState` + "Criar sala"), erro sem dados (`role="alert"` + "Tentar novamente" ou
  "Entrar novamente" em 401) e erro com cache (lista permanece + banner `role="alert"` com
  retry).
- **Cache (SPEC §10):** TanStack Query com `staleTime` 30 s, `gcTime` 24 h e persistência em
  `localStorage` apenas de consultas `rooms` bem-sucedidas. A chave inclui o `userId`, e o cache
  (memória + armazenado) é limpo ao sair ou trocar de usuário. O token de sessão continua em
  cookie `httpOnly` e nunca entra no cache.
- **Responsivo** em 375, 768, 1024 e 1440 px.

### 6.8 Modal

Componente `Modal` em `features/membership/components/Modal.tsx`. Enquanto um segundo slice não
precisar dele, ele fica na fatia de membership (regra de `shared/` do `AGENTS.md`).

- **Estrutura:** overlay `fixed inset-0 z-50` com fundo `bg-background/80`; painel central
  `max-w-md`, `bg-surface`, `border border-border`, `rounded-xl`, `p-6`, `max-h-[90vh]` com rolagem
  interna (o `body` não rola).
- **Semântica:** `role="dialog"` + `aria-modal="true"` + `aria-labelledby` apontando para o título.
  A descrição, quando existe, entra em `aria-describedby`.
- **Overlay próprio, não `<dialog>` nativo:** o jsdom usado nos testes não implementa
  `showModal()`. Com o overlay o foco é verificável por teste, e é justamente o comportamento que
  quebra sem ninguém notar.
- **Foco:** ao abrir, o primeiro elemento focável recebe o foco; `Tab` no último volta ao primeiro e
  `Shift+Tab` no primeiro vai ao último, sempre dentro do painel. Ao fechar, o foco volta ao
  elemento que abriu o modal.
- **Fechamento:** `Escape`, clique no backdrop e botão "Fechar". Clique no painel não fecha. O botão
  "Fechar" tem nome acessível (`aria-label`), alvo `size-11` (44 px) e fica por último no DOM para
  não roubar o foco inicial do primeiro campo.
- **Scroll:** `document.body.style.overflow = 'hidden'` enquanto aberto, restaurado ao desmontar.
- **Sem animação de entrada**, portanto nada a desligar em `prefers-reduced-motion`.

### 6.9 Modal de entrada na sala (#26)

`JoinRoomModal` em `features/membership/components/JoinRoomModal.tsx`, passo 3 do fluxo do
espectador (RNF03). Compõe o `Modal` da §6.8 e o `TextField` de `shared/`.

- **Nickname é obrigatório, inclusive na entrada anônima.** "Anônimo" significa _sem conta_ (sem
  e-mail, sem senha), não _sem nome_: a presença precisa de um nome para identificar quem está na
  sala, e o backend responde 422 quando o anônimo chega sem nickname
  (`backend/app/features/rooms/service.py`). Não torne o campo opcional "para simplificar" — isso
  quebra a integração e viola a constraint `nickname_required` de `room_members`.
- **Limite de 60 caracteres**, espelhando `JoinRequest.nickname` (`max_length=60`) e
  `room_members.nickname` (`String(60)`). O valor é aparado (`trim`) antes de validar e de enviar.
- **Contagem por code point** (`Array.from(...).length`), porque o backend conta caracteres em
  Python: um emoji conta 1 lá e 2 em unidades UTF-16 no JavaScript.
- **Sem `maxLength` no input.** Com ele o navegador truncaria o texto e o erro de tamanho nunca
  apareceria; a validação é do formulário, não do campo.
- **Quando valida:** no envio; depois do primeiro erro, a cada tecla, e o erro some assim que o
  valor fica válido. Não existe mínimo inventado — o backend aceita 1 caractere.
- **Erro:** junto ao campo, via `TextField` (`role="alert"`, `aria-invalid`, `aria-describedby`).
  Texto sempre presente, nunca só cor.
- **Duas ações:** "Entrar na sala" (primário, `type="submit"`) e "Entrar sem conta" (secundário).
  As duas validam o nickname; a diferença é apenas a flag `anonymous` enviada.
- **Envio em andamento:** `isSubmitting` desabilita o campo e as duas ações.
- **Contrato:** o modal chama `onJoin({ nickname, anonymous })` e não navega nem chama a API — a
  página decide o destino. Quando `accessCode` é informado, o código aparece na descrição.
- **Revisão visual:** a página `/rooms/join` existe apenas em `import.meta.env.DEV`; a rota real
  de entrada por código é descrita na §6.10.

### 6.10 Entrada por código e identificação (#25)

Fluxo do espectador (RNF03), passos 2 e 3, para visitantes autenticados: `CodeEntryPage` em
`app/pages/CodeEntryPage.tsx` e `IdentificationPage` em `app/pages/IdentificationPage.tsx`,
compostas por `CodeEntryRoute` e `JoinRoomRoute` em `app/routes/`.

- **Rotas:** `/rooms/join` para o código e `/rooms/:roomId/join` para a identificação, ambas dentro
  de `ProtectedRoute`/`AppShell`. A navegação principal marca "Entrar com código" com
  `aria-current="page"` em qualquer rota terminada em `/join`; "Minhas salas" deixa de ser a seção
  atual nesse caso.
- **Passo visível:** "Passo 2 de 4" no código e "Passo 3 de 4" na identificação, em
  `text-xs font-medium tracking-[0.2em] text-accent uppercase`, seguidos de `h1` em `font-mono
text-3xl font-semibold tracking-tight` com `tabIndex={-1}` para receber foco programático.
- **Campo do código:** `TextField` com `hint` ("6 caracteres, como K7M2QX."), `font-mono`,
  `tracking-[0.25em] uppercase`, `autoComplete="off"`, `autoCapitalize="characters"`,
  `autoCorrect="off"` e `spellCheck={false}`. A normalização (`normalizeAccessCode`) roda a cada
  tecla, então colar com espaços, hífen ou minúsculas funciona.
- **Validação local antes da API:** vazio → "Informe o código de acesso."; incompleto → "O código de
  acesso tem 6 caracteres.". O erro fica no campo (`aria-invalid`, `aria-describedby`) e o foco
  volta para ele — depois que o campo deixa de estar `disabled`, não durante o envio.
- **Validação remota:** `GET /api/rooms/by-code/{codigo}` via `roomsApi.getByCode`, sem cache. Código
  inexistente (`room_not_found`) vira erro de campo e preserva o valor digitado. Falha de rede,
  sessão expirada e erro desconhecido usam `role="alert"` acima do botão; a sessão expirada
  oferece "Entrar novamente", que encerra a sessão e leva ao login.
- **Estado de envio:** o botão alterna para "Verificando…", recebe `aria-busy="true"` e desabilita
  campo e ação; o foco é aplicado quando o envio termina.
- **Sala encerrada:** resposta `status: "closed"` bloqueia o avanço com
  "Esta sala já foi encerrada. Peça um novo código ao dono." e não navega.
- **Privacidade:** o código nunca aparece em log de falha. `apiRequest` recebe
  `logPath: '/api/rooms/by-code/{codigo}'`, então o path registrado é o modelo, não o valor.
- **Identificação é um shell nesta entrega:** reusa `JoinRoomModal` (§6.9) e apenas registra a
  escolha em um `role="status"`; o `POST /join` pertence à tarefa de entrada. Fechar o modal volta
  para `/rooms/join` com o código preservado em `location.state`.
- **Guarda de URL direta:** sem `location.state.room`, com `id` diferente de `:roomId` ou com sala
  encerrada, a página mostra "Código necessário" (ou "Sala encerrada") e um link para informar outro
  código — nunca renderiza o modal sem a validação do passo anterior.
- **Foco visível:** anéis `focus-visible:ring-2` em links e ações, alvos `min-h-11` (44 px), textos
  sempre acompanhados de mensagem (nunca só cor).

### 6.11 Layout da sala de edição/visualização (#35)

Shell compartilhado pelas duas páginas da sala: `RoomLayout` em `app/layouts/RoomLayout.tsx`,
composto por `OwnerRoomPage` e `SpectatorRoomPage`. A composição mora em `app/` porque cruza as
fatias `rooms`, `live_code` e `membership` (regra de composição do `AGENTS.md`).

- **Estrutura em três blocos.** `header` (identidade e ações), `corpo` (área de código, conteúdo
  principal e com toda a largura livre) e `aside` (participantes). O corpo recebe `children`; o
  `aside` é sempre renderizado pelo layout. Motivo: sem um contrato escrito, as duas páginas voltam
  a divergir — foi o que aconteceu entre a #20 e a #34.
- **Título com o código ao lado.** O `h1` continua "Sua sala" (dono) e "Sala ao vivo" (espectador),
  em `font-mono text-2xl sm:text-3xl`; o código de acesso fica imediatamente ao lado, em chip
  `font-mono text-sm tracking-[0.2em] select-all` com botão "Copiar código K7M2QX" (`min-h-11
min-w-11`, ícone SVG `aria-hidden`). Motivo: `rooms` não tem coluna de nome — o código é a única
  identidade da sala, e prometer um "nome da sala" seria inventar campo que não existe no banco.
- **Somente leitura em dois níveis.** Badge textual "Somente leitura" no header, ao lado do status,
  e o aviso fixo já documentado em §6.6 quando a página o fornece. No dono, a sala encerrada usa
  `readOnly` + "Encerrada" + badge + aviso "Esta sala foi encerrada…"; no espectador, badge + aviso
  da §6.6. Motivo: a indicação precisa sobreviver a daltonismo e a zoom — cor sozinha não informa
  (RF06/RNF01). O `readOnly` continua sendo interface; o servidor é a autoridade.
- **Participantes com fallback explícito.** `ParticipantList`
  (`features/membership/components/ParticipantList.tsx`) recebe `participants: Participant[]`; sem
  nomes, mostra a contagem real do WebSocket ("Nenhum participante conectado ainda", "1 participante
  conectado", "N participantes conectados") em `aria-live="polite"`. Quando há nomes, a lista vence e
  a contagem desaparece. Motivo: o frame `presence` só carrega `count` e `role`, e não existe
  endpoint que exponha os nicknames; exibir as duas informações deixaria "3 participantes" ao lado de
  uma lista com dois nomes. O dono marca-se com "(dono)".
- **Breakpoints 768 e 1024.** Abaixo de 768 px, uma coluna: header, aviso, editor, participantes
  abaixo. Entre 768 e 1023 px, uma coluna com os participantes em grade de duas colunas. A partir de
  1024 px (`lg`), duas colunas: editor em `flex-1` e participantes em `lg:w-72` (`18rem`), com o
  header ocupando a largura toda. Motivo: fixa por escrito a responsividade que a #20 e a #34
  entregaram sem documentar.
- **Altura do editor por faixa.** `h-[60vh] lg:h-[70vh]` — altura generosa, não viewport exata. Motivo:
  o `CodeEditor` traz `min-h-64` embutido (§6.5); tentar `min-h-0`/`flex` para "caber sem scroll"
  depende da ordem do CSS gerado pelo Tailwind e esmaga o editor em telas baixas. A área de código
  domina a tela sem apostar nessa briga.
- **Feedback de cópia em região viva persistente.** O parágrafo de feedback usa `aria-live="polite"`
  com altura reservada (`min-h-5`), **sem** `role="status"` — o `role="status"` do espectador pertence
  ao `ConnectionStatus` (§6.6), e dois elementos com o mesmo papel tornam a região ambígua para
  leitores de tela.

### 6.12 Tela "Salas que participei" (#27)

Rota `/rooms/joined`, composta por `app/routes/JoinedRoomsRoute.tsx` (auth + API + cache) e
`app/pages/JoinedRoomsPage.tsx` (apresentação). Entrega o RF04: o usuário autenticado vê as salas em
que entrou como **espectador**, com status e acesso rápido. Salas de outros usuários que ele não
entrou nunca aparecem — o filtro é por `user_id` da sessão e `role = 'viewer'` no servidor (SPEC §8).

- **Abas de filtro.** `RoomListTabs` (`features/rooms/components/RoomListTabs.tsx`) é uma
  `nav aria-label="Filtro de salas"` com "Criadas por mim" (`/rooms`) e "Participei"
  (`/rooms/joined`), `aria-current="page"` na aba ativa, `min-h-11` (44 px) e foco visível. Cada lista
  tem URL própria: refresh, deep link e botão voltar preservam a escolha. O `AppShell` não ganha item
  novo; "Minhas salas" continua `aria-current` nas duas rotas, e "Entrar com código" permanece
  exclusivo de `/rooms/join`.
- **Card** (`features/rooms/components/JoinedRoomCard.tsx`): código como título (`font-mono`,
  `tracking`, `select-all`), `StatusBadge` textual ("Aberta"/"Encerrada"), linguagem, "entrou em
  dd/mm/aaaa" e "Copiar" com o mesmo feedback de `RoomCard` (§6.7). Ações em ordem visual, alvos
  ≥ 44 px e quebra de linha no mobile.
- **Acesso rápido só em sala aberta.** O link "Assistir sala" leva a `/rooms/:roomId/view`
  (somente leitura). Em sala encerrada o link não existe e o card mostra "Sala encerrada: não é
  possível assistir. Peça um novo código ao dono." — o servidor também recusa entrada em sala
  fechada, então a interface não promete o que o backend nega.
- **Identidade sem nome de sala.** `rooms` não tem coluna de nome; o código de acesso é a identidade
  (mesma decisão da §6.11). O código exibido é o **atual**: regenerar o código do dono atualiza a
  lista após a invalidação do cache.
- **Estados:** carregando (`role="status"` "Carregando salas…"), vazio (`EmptyState` "Você ainda não
  entrou em nenhuma sala" + link "Entrar com código" → `/rooms/join`), erro sem dados (`role="alert"`
  + "Tentar novamente" ou "Entrar novamente" em 401) e erro com cache (lista permanece + banner
  `role="alert"` com retry). O header também oferece "Entrar com código".
- **Contagem:** "X abertas · Y encerradas" com plural correto, sempre em texto (nunca só cor).
- **Cache (SPEC §10):** `GET /api/rooms/joined` responde sob `rooms:joined:{user_id}` (TTL 30 s) e é
  invalidado ao entrar na sala e, porque o item carrega status e código, ao encerrar e ao regenerar
  (clear do cache de participações; a chave é por usuário e não há índice de membros). No frontend,
  `useJoinedRooms` usa a chave `['rooms','joined',userId]`: entra na persistência de `queryClient.ts`,
  só busca com sessão e é limpa ao sair ou trocar de usuário.
- **Responsivo** em 375, 768, 1024 e 1440 px (grade de 1, 2 e 3 colunas, como em §6.7).
### 6.12 Histórico de versões da sala (#41)

Painel do dono para consultar e restaurar versões (RF11). A fatia vive em `features/versions/`:
`VersionHistoryPanel` é apresentacional (lista, seleção e confirmação) e `VersionHistory` é a
composição conectada (API, cache e mensagens). A página do dono recebe o painel pelo render prop
`renderVersionHistory(onRestored)` e o renderiza **abaixo do editor**; o callback devolve o conteúdo
restaurado ao editor da página, sem duplicar o estado do código.

- **Só o dono vê o painel.** O servidor continua sendo a autoridade: `403 forbidden` para qualquer
  outra identidade. A interface nunca decide autorização.
- **Lista somente de metadados.** O contrato de listagem (`VersionOut`, #40) é _hash-only_: a lista
  traz `created_at`, `language`, `author_id` e `content_hash`, nunca o conteúdo. Cada linha mostra
  data e hora (`dd/mm/aaaa às HH:mm:ss`, `America/Sao_Paulo`, igual a `rooms/format.ts`), a
  linguagem, a origem — **Automática** quando `author_id` é nulo (job de snapshot) e **Restauração**
  quando foi gravada pelo dono — e um prefixo curto de `content_hash` (`#a1b2c3d`), com o hash
  completo em `title`. A prévia de conteúdo fica para uma tarefa futura que estenda o contrato.
- **Ordem e volume.** Mais recente primeiro, com desempate por `id` igual ao do backend
  (`created_at`, `id` descendentes). A API não pagina e a retenção guarda 30 dias de snapshots de
  30 s; por isso o painel renderiza 20 linhas por vez e revela as anteriores em "Mostrar versões
  anteriores" (sem dependência nova, sem virtualização).
- **Seleção e restauração.** A lista é um `fieldset` com `legend` (visualmente oculto) e um
  `radio` nativo por versão; setas do teclado funcionam sem código extra. Um único botão
  "Restaurar versão" fica desabilitado sem seleção. Ele abre o `ConfirmDialog` da §6.7 com o
  título "Restaurar versão de dd/mm/aaaa às HH:mm:ss?", o aviso de que o código será substituído e
  uma nova versão será criada, e "Restaurando…" durante o envio. Enquanto o envio corre, ESC,
  backdrop e "Cancelar" não fecham o diálogo.
- **Sucesso.** O diálogo fecha, a seleção é limpa, a lista é invalidada (a nova versão aparece no
  topo) e a região `aria-live="polite"` (sem `role="status"`, pela mesma razão da §6.11) anuncia
  "Versão de … restaurada. O código da sala foi atualizado.". Falha mantém o diálogo aberto com a
  mensagem mapeada (`room_closed`, `version_not_found`, `forbidden`, `not_authenticated`,
  `network_error`), em `role="alert"`.
- **Sala encerrada.** O histórico continua legível (o backend permite a listagem), mas restaurar
  responde `409 room_closed`; o painel desabilita a ação e explica em texto: "Esta sala foi
  encerrada. O histórico continua disponível, mas não é possível restaurar versões.".
- **Estados.** Carregando: `role="status"` com `Spinner` e altura mínima reservada. Vazio:
  `EmptyState` "Nenhuma versão ainda", explicando que a primeira versão aparece quando o código
  muda. Erro sem dados: `role="alert"` com "Tentar novamente". Erro com dados em cache: a lista
  permanece e um banner `role="alert"` oferece nova tentativa (mesmo padrão da §6.7).
- **Cache (SPEC §10).** TanStack Query com chave `['versions', roomId]`, `staleTime` de 30 s,
  `refetchOnWindowFocus` e invalidação explícita após restaurar. **Somente memória**: a lista muda a
  cada 30 s enquanto a sala é editada, então persistir em `localStorage` serviria histórico
  desatualizado; o estado atual do código nunca passa por cache (RNF02).
- **Acessibilidade e responsividade.** Títulos em `font-mono`, alvos ≥ 44 px, foco visível,
  `cursor-pointer`, nenhuma informação só por cor (origem e estado sempre em texto) e
  `motion-safe`/`prefers-reduced-motion` respeitados. O painel ocupa a largura do corpo em todas as
  faixas; o `aside` de participantes da §6.11 não muda.
- **Revisão visual.** `DevOwnerRoomPage` liga o painel a uma API em memória e a um seletor
  DEV-only de estados (Lista / Vazio / Carregando / Erro), porque as telas da sala ainda usam
  fixtures. A restauração de desenvolvimento também atualiza o editor.

## 7. Checklist de entrega

- [ ] Nenhum emoji como ícone; SVG com `aria-hidden` quando decorativo.
- [ ] `cursor-pointer` em elementos clicáveis.
- [ ] Hover/transições suaves (150–300 ms).
- [ ] Contraste de texto ≥ 4.5:1.
- [ ] Foco visível para navegação por teclado.
- [ ] `prefers-reduced-motion` respeitado.
- [ ] Responsivo em 375, 768, 1024 e 1440 px.
- [ ] Rótulos visíveis em formulários; erros junto ao campo.
- [ ] Alvos de toque ≥ 44×44 px.

## 8. Anti-padrões

- Tema claro como padrão (o produto é dark-first).
- Emoji como ícone.
- Remover o anel de foco.
- Hexadecimais soltos em componentes.
- Texto cinza sobre cinza ou contraste insuficiente.
- Animação sem propósito ou sem `prefers-reduced-motion`.
