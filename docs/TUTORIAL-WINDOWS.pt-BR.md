# Tutorial para Windows (Português)

Siga este guia se você está no **Windows** e quer rodar o CodeLive de forma
nativa (no PowerShell ou CMD), sem WSL.

> **Já está no Linux, macOS ou WSL?** Você não precisa deste arquivo — o
> `README.md` principal funciona lá do jeito que está.

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

> **Observação:** no Windows, todo comando Python usa `.venv\Scripts\python.exe`
> em vez do `.venv/bin/python` do Linux/macOS. Neste guia esse programa é
> escrito como `$py` por brevidade — defina-o uma vez:

```powershell
$py = ".\.venv\Scripts\python.exe"
```

---

## Passo 1 — Criar o ambiente Python

```powershell
py -3.14 -m venv .venv
& $py -m pip --version
```

Você deve ver `pip 26.x ...`.

(Se `py -3.14 -m venv` reclamar de `ensurepip` ausente, pule e faça o
bootstrap do pip, exatamente como no README principal:

```powershell
Invoke-WebRequest -Uri https://bootstrap.pypa.io/get-pip.py -OutFile $env:TEMP\get-pip.py
& $py $env:TEMP\get-pip.py
```

)

---

## Passo 2 — Instalar as dependências

```powershell
& $py -m pip install -r requirements.txt -r requirements-dev.txt
```

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
& ..\.venv\Scripts\alembic.exe upgrade head
cd ..
```

---

## Passo 6 — Rodar o app

```powershell
cd backend
& ..\.venv\Scripts\uvicorn.exe app.main:app --reload --no-access-log
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
& $py -m pytest backend/app/features -q
& $py -m pytest backend/tests/integration -q
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

Veja `docs/TUTORIAL-WINDOWS.md` para o mesmo guia em inglês.
