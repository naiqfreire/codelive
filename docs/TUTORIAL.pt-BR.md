# Tutorial — Linux, macOS ou WSL (Português)

Siga este guia no **Linux, macOS ou WSL (Ubuntu/Debian)**.

> **Está no Windows sem WSL?** Use o passo a passo nativo para Windows:
> [docs/TUTORIAL-WINDOWS.pt-BR.md](TUTORIAL-WINDOWS.pt-BR.md).

---

## O que você precisa

1. **Python 3.14** — verifique com:

   ```bash
   python3.14 --version
   ```

   Se o comando não existir, instale o Python 3.14 para o seu sistema
   (downloads em python.org) e garanta que `python3.14` aponte para ele.

2. **Docker** (com Compose v2) — verifique com:

   ```bash
   docker --version
   docker compose version
   ```

   Inicie o Docker (Docker Desktop no macOS/Windows-com-WSL, ou o serviço
   Docker no Linux) e confirme que os dois comandos imprimem uma versão.
   No WSL, ative a **integração WSL** do Docker Desktop para a sua
   distribuição (Settings → Resources → WSL integration).

3. **Git** — instale-o e clone o repositório:

   ```bash
   git clone <URL-DO-REPO>
   cd codelive
   ```

   Use a URL do repositório no GitHub/GitLab. Os comandos abaixo assumem que
   você está na raiz do projeto, onde este README fica.

---

## Passo 1 — Criar o ambiente Python

Projetos Python guardam suas dependências numa pasta chamada `.venv`
(um "ambiente virtual"), para não poluir o Python do sistema.

Em algumas imagens Linux, a ferramenta `pip` (o instalador de pacotes do
Python) não existe. Se isso acontecer, crie o venv sem pip e depois instale
o pip dentro dele:

```bash
python3.14 -m venv --without-pip .venv
curl -o /tmp/get-pip.py https://bootstrap.pypa.io/get-pip.py
.venv/bin/python /tmp/get-pip.py
```

Se `python3.14 -m venv .venv` funcionar na sua máquina, use só ele — o
resultado é o mesmo. Verifique:

```bash
.venv/bin/python -m pip --version
```

Você deve ver algo como `pip 26.x ...`.

A partir daqui, todos os comandos Python deste guia usam `.venv/bin/python`,
assim você sempre roda o Python do projeto, com os pacotes do projeto.

---

## Passo 2 — Instalar as dependências

```bash
.venv/bin/python -m pip install -r requirements.txt -r requirements-dev.txt
```

- `requirements.txt` — pacotes de que o app precisa para rodar.
- `requirements-dev.txt` — pacotes extras necessários apenas para os testes.

Isso baixa tudo do PyPI. Na primeira vez pode levar um minuto.

---

## Passo 3 — Configurar o ambiente

O app lê cinco configurações de um arquivo chamado `.env` na raiz do projeto.
Crie-o a partir do modelo:

```bash
cp .env.example .env
```

Abra o `.env` no seu editor e defina `SESSION_SECRET` como uma string longa
e aleatória. Gere uma com o Python (sem ferramenta além do passo 1):

```bash
python3.14 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copie a saída para o `.env`, substituindo o valor de exemplo.

**Importante:** nunca faça commit do `.env` no git. Ele guarda o seu segredo
local. É por isso que ele está no `.gitignore`.

---

## Passo 4 — Iniciar o banco de dados

O CodeLive usa PostgreSQL, rodando dentro do Docker. Inicie com:

```bash
docker compose up -d --wait
```

Isso sobe dois bancos:

- `codelive` na porta 5432 (o banco do app)
- `codelive_test` na porta 5433 (usado apenas pelos testes)

Verifique se estão rodando:

```bash
docker ps
```

Você deve ver dois contêineres chamados `codelive_postgres` e
`codelive_postgres_test`, ambos `Up` e `healthy`.

Para parar depois:

```bash
docker compose down
```

---

## Passo 5 — Criar as tabelas do banco

O esquema é gerenciado pelo **Alembic** (a ferramenta de migrações). Rode as
migrações:

```bash
cd backend && ../.venv/bin/alembic upgrade head
```

Volte para a raiz do projeto depois:

```bash
cd ..
```

Se uma migração falhar, leia a mensagem de erro de baixo para cima — ela
geralmente mostra a causa real (banco parado, `.env` errado etc.).

---

## Passo 6 — Rodar o app

```bash
cd backend && ../.venv/bin/uvicorn app.main:app --reload --no-access-log
```

- `uvicorn` é o servidor web que roda o app.
- `--reload` reinicia o servidor automaticamente quando você edita código.
- `--no-access-log` desliga o log de acesso do uvicorn, porque o app
  já escreve suas próprias linhas de log de acesso em JSON (eventos
  `http_request`). Isso mantém um único fluxo de log limpo, em vez de
  dois formatos diferentes.

Abra o navegador em <http://localhost:8000/docs> — você deve ver a
documentação interativa da API. O app está pronto quando essa página carrega.

Teste:

```bash
curl http://localhost:8000/api/health
```

Você deve receber:

```json
{"status": "ok", "db": "ok"}
```

Para parar o servidor, pressione `Ctrl+C`.

> **Limitação importante:** o cookie de login (`codelive_session`) é sempre
> marcado como `Secure`, então os navegadores só o aceitam sobre HTTPS —
> com uma exceção: `http://localhost` e `http://127.0.0.1` contam como
> contextos seguros. Ou seja: teste a API sempre via `localhost`/`127.0.0.1`.
> Abrir por IP da rede local em HTTP puro não manterá você logado,
> porque o navegador recusa guardar o cookie.

---

## Passo 7 — Rodar os testes

Testes unitários (rápidos, sem banco de dados):

```bash
.venv/bin/python -m pytest backend/app/features -q
```

Testes de integração (precisam do banco de dados do passo 4 rodando):

```bash
.venv/bin/python -m pytest backend/tests/integration -q
```

Ambos devem terminar com `passed`. Se um teste falhar, rode de novo com `-v`
(e sem `-q`) para ver a mensagem de erro completa.

---

## Endpoints da API (todos sob `/api`)

| Método | Caminho | O que faz |
| ------ | ------- | --------- |
| GET | `/api/health` | Verificação de saúde (app + banco) |
| POST | `/api/auth/register` | Cria uma conta e faz login |
| POST | `/api/auth/login` | Faz login com e-mail + senha |
| POST | `/api/auth/logout` | Faz logout (limpa o cookie) |
| GET | `/api/auth/me` | Quem sou eu? (precisa do cookie de login) |

Toda resposta de erro tem este formato:

```json
{"error": {"code": "not_authenticated", "message": "Não autenticado.", "request_id": "..."}}
```

---

## Resolução de problemas

| Sintoma | Causa provável | Correção |
| ------- | -------------- | -------- |
| `docker: command not found` | Docker não instalado/iniciado | Instale e inicie o Docker; no WSL, ative a integração WSL |
| `ModuleNotFoundError: No module named 'app'` | Diretório errado | Rode os testes a partir da raiz; o servidor a partir de `backend/` |
| Health check retorna `db: unavailable` | Banco parado | `docker compose up -d --wait` (passo 4) |
| Você loga e cai na hora | Host errado | Use `http://localhost:8000`, não IP da rede local (cookie é `Secure`) |
| `pip: command not found` | venv criado sem pip | Siga o bootstrap com `get-pip.py` do passo 1 |
