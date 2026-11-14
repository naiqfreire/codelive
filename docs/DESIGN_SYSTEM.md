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
sem a aba "Participei" nesta entrega.

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
- **Revisão visual:** a página `/rooms/join` existe apenas em `import.meta.env.DEV`; a rota real do
  espectador pertence ao fluxo de entrada.

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
