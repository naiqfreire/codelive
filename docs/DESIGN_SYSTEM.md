# Design System — CodeLive

Referência de identidade visual do CodeLive. Combina a atmosfera escura e imersiva de
colaboração do **kosmi.io** com a clareza e o foco em código do **onlinegdb.com**, usando os
tokens verificados do skill `ui-ux-pro-max` (estilo *Dark Mode / OLED*, "code dark + run green").

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

| Papel                  | Token Tailwind        | Hex       | Uso                                      |
| ---------------------- | --------------------- | --------- | ---------------------------------------- |
| Fundo                  | `bg-background`       | `#0F172A` | Fundo da aplicação                       |
| Texto                  | `text-foreground`     | `#F8FAFC` | Texto principal                          |
| Superfície / card      | `bg-surface`          | `#1B2336` | Cards, toolbars, modais                  |
| Borda                  | `border-border`       | `#475569` | Divisórias e contornos                   |
| Primária (estrutural)  | `bg-primary`          | `#1E293B` | Botões neutros e cabeçalhos              |
| Secundária             | `bg-secondary`        | `#334155` | Estados intermediários                   |
| Acento / CTA           | `bg-accent`           | `#22C55E` | Ação principal, foco, status "ao vivo"   |
| Texto sobre acento     | `text-accent-foreground` | `#0F172A` | Texto em botões verdes                |
| Muted                  | `bg-muted`            | `#272F42` | Fundos discretos                         |
| Texto muted            | `text-muted-foreground` | `#94A3B8` | Apoio, placeholders, legendas          |
| Destrutivo             | `bg-destructive`      | `#EF4444` | Erros e ações destrutivas                |
| Anel de foco           | `ring-ring`           | `#FFFFFF` | `focus-visible`                          |

Regras:

- Não usar cores de estado apenas por cor; acompanhar de texto ou ícone.
- Verde é ação/estado positivo, nunca decoração.
- Contraste mínimo 4.5:1 para texto; 3:1 para elementos de interface.

## 3. Tipografia

| Uso                          | Fonte            | Classes                          |
| ---------------------------- | ---------------- | -------------------------------- |
| Corpo, labels, navegação     | **IBM Plex Sans** | `font-sans`                     |
| Títulos, código, códigos     | **JetBrains Mono** | `font-mono`                    |

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
- Primeira versão: `<select>` nativo estilizado — acessível por teclado e leitor de tela.
- Rótulo visível associado ao controle; ícone/indicador da linguagem ao lado do valor.
- Altura mínima 44 px, borda `border-border`, fundo `bg-surface`, foco `ring-ring`.
- Estado desabilitado com `opacity-50` e `cursor-not-allowed`.

### 6.2 AccessCode (#19)

Código de acesso de **6 caracteres**, maiúsculos, sem ambíguos
(`A–Z` sem `O/I/L` + dígitos `2–9`), por exemplo `K7M2QX`.

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

### 6.4 Layout de autenticação (#11)

`AuthLayout` é o shell de login e registro: painel de marca (oculto abaixo de `lg`) + área de
formulário centralizada (`max-w-md`). As páginas são apenas layout; nenhuma chamada de API entra
nesta fatia.

- **Foco:** anel global `focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background` em
  `src/index.css`; campos e botões herdam o mesmo tratamento. Ordem de tabulação = ordem visual,
  sem `tabIndex` positivo.
- **Erro:** mensagem em `role="alert"` com `text-destructive`, associada ao campo via
  `aria-describedby` e `aria-invalid`, sempre com texto (nunca só cor). Erros de formulário
  (campos vazios) aparecem acima do botão; erros de campo ficam junto ao campo.
- **Carregamento:** o botão de envio entra em `isLoading` → `aria-busy="true"`, `disabled`, rótulo
  "Entrando…"/"Criando conta…" e `Spinner`; os campos ficam `disabled` durante o envio e o estado
  volta ao normal no `finally`.
- **Rota:** `/` redireciona para `/login`; `/register` fica no mesmo layout. Páginas são lazy com
  fallback `role="status"` ("Carregando…").
- **Alvos:** botão e campos com `min-h-11` (44 px).

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
