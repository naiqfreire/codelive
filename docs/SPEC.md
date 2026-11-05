# SPEC.md — CodeLive

Especificação pública do CodeLive. Este documento é a fonte da verdade para a definição do sistema, requisitos, arquitetura, modelo de dados e observabilidade. O fluxo de trabalho de engenharia para agentes vive em [`AGENTS.md`](AGENTS.md).

## 1. Visão geral

O CodeLive é uma plataforma web que permite a qualquer usuário autenticado criar salas de código com acesso por código único. O dono da sala edita o código em tempo real, enquanto outros usuários entram como espectadores e visualizam em modo somente leitura. O sistema oferece destaque de sintaxe, atualização automática e histórico de versões.

Público-alvo: estudantes, professores e qualquer pessoa que queira compartilhar código ao vivo.

Fluxo principal: o dono cria uma sala com código de acesso aleatório, escolhe a linguagem e edita o código. Os espectadores entram com esse código, de forma anônima ou com nickname, e acompanham a evolução em modo somente leitura. A tela é atualizada automaticamente e o sistema salva versões periodicamente.

## 2. Stack tecnológica

| Camada                          | Tecnologias                          |
| ------------------------------- | ------------------------------------ |
| Front-end                       | React, TypeScript, Vite, TailwindCSS |
| Back-end                        | Python                               |
| Banco de dados                  | PostgreSQL                           |
| Linguagens de código suportadas | Python, Java, C, PHP e JavaScript    |

## 3. Requisitos funcionais (RF)

- **RF01** — O sistema deve permitir cadastro e login de usuário.
- **RF02** — O sistema deve permitir que um usuário autenticado crie uma sala com geração de código único de acesso.
- **RF03** — O sistema deve listar para o usuário as salas que ele criou (como dono).
- **RF04** — O sistema deve listar para o usuário as salas em que ele entrou como espectador.
- **RF05** — O sistema deve permitir que um espectador entre na sala usando o código, de forma anônima ou com nickname.
- **RF06** — O sistema deve permitir que apenas o dono da sala edite o código.
- **RF07** — O sistema deve exibir o código para espectadores em modo somente leitura.
- **RF08** — O sistema deve permitir que o dono da sala escolha a linguagem do código (Java, Python, C, etc.).
- **RF09** — O sistema deve destacar a sintaxe do código conforme a linguagem escolhida.
- **RF10** — O sistema deve salvar automaticamente versões anteriores do código a cada 30 segundos.
- **RF11** — O sistema deve permitir que o dono da sala consulte e restaure versões anteriores do código.
- **RF12** — O sistema deve permitir que o dono da sala encerre a sala ou regenere o código de acesso.
- **RF13** — O sistema deve impedir que espectadores editem o código, mesmo que tentem acessar rotas de edição.

## 4. Requisitos não funcionais (RNF)

- **RNF01** — Apenas o dono da sala pode editar o código; tentativas não autorizadas devem retornar o erro 403 e não alterar o conteúdo.
- **RNF02** — A visualização do espectador deve ser atualizada automaticamente em até 5 segundos após a edição do dono da sala.
- **RNF03** — O espectador deve conseguir entrar na sala digitando o código em no máximo 4 passos definidos: (1) acessar o site, (2) digitar o código, (3) informar nickname ou escolher anônimo, (4) visualizar o código.
- **RNF04** — O código salvo não pode ser perdido em caso de recarregamento da página ou queda simples de conexão.
- **RNF05** — O sistema deve suportar pelo menos 2 turmas ativas ao mesmo tempo, com 30 usuários simultâneos cada.
- **RNF06** — Em caso de falha, o sistema não deve perder mais de 30 segundos de edição.
- **RNF07** — O sistema deve utilizar apenas ferramentas gratuitas e de código aberto.
- **RNF08** — O sistema deve funcionar nos navegadores Chrome, Firefox e Edge em suas versões atuais.
- **RNF09** — O sistema deve rodar em Windows e Linux e permitir deploy em serviço gratuito.
- **RNF10** — O código-fonte deve ser versionado no GitHub, com README e commits organizados.
- **RNF11** — O sistema não deve exigir e-mail ou dados pessoais do espectador anônimo para entrada na sala.

## 5. Arquitetura

Arquitetura de slices verticais (Vertical Slice Architecture). Cada fatia representa uma user story e contém rota, validação, regras de negócio, persistência e testes. O kernel compartilhado contém apenas infraestrutura.

```text
backend/app/
├── shared/               # Configuração, sessão de banco, segurança, erros, hub WebSocket
└── features/
    ├── auth/             # US1: cadastro, login, sessão e usuários
    ├── rooms/            # US2: criação, listagem, encerramento e código de acesso
    ├── membership/       # US3: entrada do espectador, nickname e sessão anônima
    ├── live_code/        # US4: código atual, WebSocket, broadcast e modo somente leitura
    └── versions/         # US5: snapshots, retenção e restauração

frontend/src/
├── app/                  # Composição da aplicação: router e providers
├── shared/               # Componentes, hooks, cliente HTTP, tipos e estilos
└── features/             # Espelhando o backend: auth, rooms, membership, live-code, versions
```

Regras de composição:

- Uma slice expõe operações às demais apenas pelo seu `public.py`.
- Routers finos: validar entrada, chamar o serviço, retornar a resposta.
- Regras de negócio vivem no serviço da fatia.
- No front-end, as chamadas HTTP vivem no `api.ts` da feature; componentes nunca chamam `fetch` diretamente.

## 6. Modelo de dados e invariantes

```text
users(id, name, email unique, password_hash, created_at, updated_at)

rooms(id, owner_id, access_code unique, language, status,
      created_at, updated_at)

room_members(id, room_id, user_id nullable, anonymous_session_id nullable,
             nickname nullable, role owner|viewer, is_anonymous, joined_at)

room_code_state(id, room_id unique, content, updated_at)

code_versions(id, room_id, content, language, author_id nullable, created_at)
```

Invariantes:

- Toda sala tem um dono.
- `access_code` é único. Regenerar invalida o código anterior.
- Sala encerrada rejeita novas entradas.
- Apenas o dono escreve o código.
- Toda sala tem um estado atual em `room_code_state`.
- Versões são imutáveis.
- Restaurar uma versão grava o conteúdo em `room_code_state` e cria uma nova versão.
- Espectador anônimo não tem e-mail nem conta.
- A limpeza de versões preserva a versão mais recente de cada sala.
- Retenção: apagar versões com mais de 30 dias, exceto a mais recente de cada sala.

## 7. API e WebSocket

| Método e rota                                   | Descrição                             |
| ----------------------------------------------- | ------------------------------------- |
| `POST api/auth/register`                        | Cadastro                              |
| `POST /auth/login`                              | Login                                 |
| `POST /rooms`                                   | Criar sala                            |
| `GET /rooms/mine`                               | Salas do dono                         |
| `PATCH /rooms/{id}/close`                       | Encerrar sala                         |
| `POST /rooms/{id}/regenerate-code`              | Regenerar código de acesso            |
| `GET /rooms/by-code/{codigo}`                   | Validar código de acesso              |
| `POST /rooms/{id}/join`                         | Entrar na sala                        |
| `GET /rooms/joined`                             | Salas em que o usuário foi espectador |
| `GET /rooms/{id}/versions`                      | Listar versões                        |
| `POST /rooms/{id}/versions/{versionId}/restore` | Restaurar versão                      |
| WebSocket `/ws/rooms/{room_id}`                 | Código ao vivo e presença             |

Mensagens WebSocket: `join`, `code_update`, `presence`, `snapshot` e `error`.

O servidor valida o dono em `code_update`. Ao entrar ou reconectar, o servidor envia um `snapshot` com o código atual.

## 8. Autorização

| Ação                         | Anônimo com código | Espectador autenticado | Dono |
| ---------------------------- | ------------------ | ---------------------- | ---- |
| Ver sala e código            | sim                | sim                    | sim  |
| Editar código                | não, 403           | não, 403               | sim  |
| Entrar na sala               | sim                | sim                    | sim  |
| Listar salas criadas         | não                | não                    | sim  |
| Listar salas participadas    | não                | sim                    | sim  |
| Encerrar ou regenerar código | não                | não                    | sim  |
| Listar ou restaurar versões  | não                | não                    | sim  |

Toda linha é validada no servidor, em REST e WebSocket. A role relatada pelo cliente nunca é confiável.

## 9. Observabilidade

Objetivo: garantir que falhas no fluxo principal sejam diagnosticáveis sem adicionar infraestrutura extra, mantendo o RNF07 (apenas ferramentas gratuitas e de código aberto) e o RNF02 (propagação em até 5 segundos).

### 9.1 Escopo do MVP

O MVP entrega observabilidade mínima, embutida na aplicação, sem serviços externos. A stack completa de observabilidade (dashboards, coleta de métricas agregadas, traces distribuídos, alertas e monitoramento externo de uptime) está planejada para depois da entrega acadêmica.

### 9.2 O que é implementado desde o início

- **Logs estruturados no back-end.** Todos os logs da aplicação FastAPI são emitidos em JSON para stdout. Os campos base são `timestamp`, `level`, `event`, `request_id`, `room_id` (quando aplicável), `user_id` (quando aplicável) e `duration_ms` (quando aplicável). Eventos específicos adicionam campos próprios: `snapshot` e `code_update` incluem `content_hash`. Não é permitido uso de `print` nem de log em texto livre no caminho principal.
- **Correlation ID por requisição.** Um middleware gera um `request_id` (UUID) no início de cada requisição REST e o propaga para os logs e para as respostas de erro. Em mensagens WebSocket, o `request_id` da conexão inicial é mantido durante toda a sessão e incluído nos logs relacionados.
- **Health check.** `GET /health` retorna `200` com `{"status": "ok", "db": "ok"}` quando a aplicação e o banco respondem, e `503` caso contrário. É o único endpoint obrigatório para verificação de disponibilidade no MVP.
- **Logs estruturados no front-end.** Erros não tratados (`window.onerror` e `unhandledrejection`), falhas de chamadas HTTP e o recebimento de `snapshot` e `code_update` são registrados no console do navegador em formato estruturado, com `timestamp` e o `request_id` retornado pelo back-end. Não há envio para serviço externo no MVP.

### 9.3 O que fica fora do escopo do MVP

- Métricas agregadas (CPU, memória, disco, rede, conexões simultâneas).
- Dashboards e visualização centralizada.
- Traces distribuídos ponta a ponta.
- Alertas automáticos.
- Monitoramento externo de uptime.
- Coleta de logs de containers ou de infraestrutura.

Esses itens serão adicionados após a entrega. Os pré-requisitos acima (logs estruturados no back-end e no front-end, correlation ID e health check) permitem que estes itens sejam uma adição, não uma reescrita.

### 9.4 Como verificar cada requisito no MVP

- **RNF02 (propagação em até 5 segundos).** Verificada manualmente: o log do `code_update` no back-end inclui `timestamp` e `room_id`; o log do front-end ao receber o `snapshot` inclui `timestamp` e `request_id`. A diferença entre os dois timestamps é a latência de propagação. O teste Playwright do fluxo ponta a ponta registra essa diferença e falha se exceder 5 segundos.
- **RNF04 (não perder código em recarregamento ou queda simples).** O log de `snapshot` e de `code_update` registra `room_id` e `content_hash`, permitindo verificar que o estado recuperado é idêntico ao último persistido.
- **RNF06 (não perder mais de 30 segundos de edição).** O job de snapshot emite um log a cada execução, com `room_id` e `duration_ms`. A ausência de logs por mais de 30 segundos durante uma edição ativa é tratada como incidente.
- **Disponibilidade.** O endpoint `GET /health` é consultado manualmente antes de cada sessão de uso. Não há monitoramento automático no MVP.

### 9.5 Retenção

No MVP, os logs residem apenas no stdout da aplicação e são retidos pela plataforma de deploy pelo período padrão do plano gratuito. Não há retenção configurada pela aplicação.

## 10. Cache

Objetivo: reduzir latência e carga em consultas de leitura sem violar o RNF02 (propagação em até 5 segundos) e o RNF07 (apenas ferramentas gratuitas e de código aberto).

Escopo: o cache cobre apenas dados que não mudam em tempo real. O estado atual do código (`room_code_state`), as mensagens WebSocket e qualquer dado no caminho de tempo real nunca passam por cache.

Back-end:

- Biblioteca: `cachetools` (MIT), em memória, por processo.
- TTL: 30 a 60 segundos por chave.
- Dados cacheados: listagem de versões por sala, listagem de salas do dono, listagem de salas participadas e metadados da sala (linguagem, status).
- Chaves prefixadas por recurso e id: `versions:{room_id}`, `rooms:mine:{user_id}`, `rooms:joined:{user_id}`, `room_meta:{room_id}`.
- Invalidação explícita após qualquer mutação que afete a chave: criar sala, encerrar sala, regenerar código, entrar na sala, restaurar versão e novo snapshot.
- O cache não substitui autorização. Toda resposta cacheada continua sujeita às regras da seção 8.

Front-end:

- Biblioteca: TanStack Query com `persistQueryClient` e `createSyncStoragePersister` em `localStorage`.
- Escopo: apenas respostas REST de dados não voláteis (listas de salas, versões, metadados). O código ao vivo continua vindo do WebSocket.
- `staleTime`: 30 segundos. `gcTime`: 24 horas.
- Invalidação: `queryClient.invalidateQueries` após mutações.

Fora de escopo no MVP: Redis ou qualquer cache distribuído. Reavaliar apenas se o back-end passar a rodar em múltiplas instâncias.

## 11. Qualidade e portabilidade

- Testes: pytest (back-end), Vitest (front-end), Playwright (fluxos completos) e k6 (carga).
- Meta de carga: 2 turmas × 30 espectadores simultâneos (RNF05), propagação em até 5 segundos, sem perda de atualizações.
- Navegadores: versões atuais de Chrome, Firefox e Edge (RNF08).
- Sistemas: Windows e Linux; deploy em serviço gratuito (RNF09).
- Versionamento no GitHub com README e commits organizados (RNF10). No MVP, commits seguem Conventional Commits com tipo e escopo em inglês e descrição em português, referenciando a task do Taiga (ex.: `feat(backend): adiciona entidade user (#4)`).
