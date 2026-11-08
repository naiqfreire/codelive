# Tutorial para Windows (Português)

Siga este guia se você está no **Windows** e quer rodar o CodeLive de forma
nativa (no PowerShell ou CMD), sem WSL.

---

## O que você precisa

1. **Python 3.14** — instale pelo python.org. Durante a instalação, marque
   **"Add python.exe to PATH"**. Verifique:

   ```powershell
   py -3.14 --version
   ```

2. **Docker Desktop** — instale, inicie e verifique:

   ```powershell
   docker --version
   docker compose version
   ```

3. **Git** — instale e clone o repositório:

   ```powershell
   git clone <URL-DO-REPO>
   cd codelive
   ```

   Os comandos abaixo assumem que você está na raiz do projeto (onde fica o
   `README.md`). Abra o **PowerShell** nessa pasta.

> **Observação:** no Windows, todo comando Python usa o Python do projeto,
> `.venv\Scripts\python.exe`. Os comandos deste guia chamam-no diretamente —
> sem ativação e sem scripts lançadores (`alembic.exe`, `uvicorn.exe`),
> porque tudo é invocado como `python -m ...`. Os passos 5 e 6 rodam de
> dentro de `backend/`, então lá o caminho é `..\.venv\Scripts\python.exe`.

---

## Passo 1 — Criar o ambiente Python

```powershell
py -3.14 -m venv .venv
& .\.venv\Scripts\python.exe -m pip --version
```

Você deve ver `pip 26.x ...`.

(Se `py -3.14 -m venv` reclamar de `ensurepip` ausente, pule e faça o
bootstrap do pip, exatamente como no README principal:

```powershell
Invoke-WebRequest -Uri https://bootstrap.pypa.io/get-pip.py -OutFile $env:TEMP\get-pip.py
& .\.venv\Scripts\python.exe $env:TEMP\get-pip.py
```

)

---

## Passo 2 — Instalar as dependências

```powershell
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-dev.txt
& .\.venv\Scripts\python.exe -m pip show alembic uvicorn
```

Você deve ver os dois pacotes listados. Se algum estiver faltando, a
instalação não foi concluída — rode novamente antes de continuar.

---

## Passo 3 — Configurar o ambiente

```powershell
Copy-Item .env.example .env
```

Abra o `.env` no seu editor e defina `SESSION_SECRET`. Gere um:

```powershell
py -3.14 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copie a saída para o `.env`, substituindo o valor de exemplo.

**Nunca faça commit do `.env`** — ele guarda o seu segredo local (está no
`.gitignore`).

---

## Passo 4 — Iniciar o banco de dados

```powershell
docker compose up -d --wait
docker ps
```

Dois contêineres saudáveis: `codelive_postgres` (porta 5432) e
`codelive_postgres_test` (porta 5433).

Para parar depois: `docker compose down`.

---

## Passo 5 — Criar as tabelas do banco

```powershell
cd backend
& ..\.venv\Scripts\python.exe -m alembic upgrade head
cd ..
```

---

## Passo 6 — Rodar o app

```powershell
cd backend
& ..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --no-access-log
```

Abra <http://localhost:8000/docs> no navegador. Verifique:

```powershell
Invoke-RestMethod http://localhost:8000/api/health
```

Esperado: `{"status": "ok", "db": "ok"}`. Para parar, `Ctrl+C`.

> **Limitação do cookie Secure:** o cookie de sessão (`codelive_session`) é
> sempre `Secure`, então teste sempre via `http://localhost` ou
> `http://127.0.0.1` — nunca via IP da rede local em HTTP puro.

---

## Passo 7 — Rodar os testes

```powershell
& .\.venv\Scripts\python.exe -m pytest backend/app/features -q
& .\.venv\Scripts\python.exe -m pytest backend/tests/integration -q
```

Ambos devem terminar com `passed`.

---

## Referência rápida para Windows

| Linux/macOS                             | Windows (PowerShell)                                 |
| --------------------------------------- | ---------------------------------------------------- |
| `python3.14`                            | `py -3.14`                                           |
| `.venv/bin/python`                      | `.\.venv\Scripts\python.exe`                         |
| `cp .env.example .env`                  | `Copy-Item .env.example .env`                        |
| `cd backend && cmd`                     | `cd backend` e depois `cmd` (ou `;`)                 |
| `curl http://localhost:8000/api/health` | `Invoke-RestMethod http://localhost:8000/api/health` |
| `docker compose up -d --wait`           | _(igual)_                                            |
| `alembic upgrade head`                  | `& ..\.venv\Scripts\python.exe -m alembic upgrade head` (de `backend/`) |
| `uvicorn app.main:app ...`              | `& ..\.venv\Scripts\python.exe -m uvicorn app.main:app ...` (de `backend/`) |

Veja `docs/TUTORIAL-WINDOWS.md` para o mesmo guia em inglês.

---

## Resolução de problemas

| Sintoma | Causa provável | Correção |
| ------- | -------------- | -------- |
| `docker: command not found` | Docker não instalado/iniciado | Instale e inicie o Docker Desktop |
| `No module named 'alembic'` | Dependências não instaladas | Rode novamente o passo 2 e verifique com `-m pip show alembic uvicorn` |
| `ModuleNotFoundError: No module named 'app'` | Diretório errado | Rode os testes a partir da raiz; o servidor a partir de `backend/` |
| Health check retorna `db: unavailable` | Banco parado | `docker compose up -d --wait` (passo 4) |
| Você loga e cai na hora | Host errado | Use `http://localhost:8000`, não IP da rede local (cookie é `Secure`) |
| `pip: command not found` | venv criado sem pip | Siga o bootstrap com `get-pip.py` do passo 1 |
