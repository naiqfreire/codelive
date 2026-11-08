# Windows Tutorial (English)

Follow this guide if you are on **Windows** and want to run CodeLive natively
(in PowerShell or CMD), without WSL.

---

## What you need

1. **Python 3.14** — install from python.org. During installation, tick
   **"Add python.exe to PATH"**. Check it:

   ```powershell
   py -3.14 --version
   ```

2. **Docker Desktop** — install, start it, and check:

   ```powershell
   docker --version
   docker compose version
   ```

3. **Git** — install and clone the repo:

   ```powershell
   git clone <REPO-URL>
   cd codelive
   ```

   The commands below assume you are in the project root (where `README.md`
   lives). Open **PowerShell** in that folder.

> **Note:** on Windows, every Python command uses the project's own Python,
> `.venv\Scripts\python.exe`. The commands in this guide call it directly —
> no activation and no launcher scripts (`alembic.exe`, `uvicorn.exe`) needed,
> because everything is invoked as `python -m ...`. Steps 5 and 6 run from
> inside `backend/`, so there the path is `..\.venv\Scripts\python.exe`.

---

## Step 1 — Create the Python environment

```powershell
py -3.14 -m venv .venv
& .\.venv\Scripts\python.exe -m pip --version
```

You should see `pip 26.x ...`.

(If `python3.14 -m venv` complains about a missing `ensurepip`, skip it and
bootstrap pip, exactly as in the main README:

```powershell
Invoke-WebRequest -Uri https://bootstrap.pypa.io/get-pip.py -OutFile $env:TEMP\get-pip.py
& .\.venv\Scripts\python.exe $env:TEMP\get-pip.py
```

)

---

## Step 2 — Install dependencies

```powershell
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-dev.txt
& .\.venv\Scripts\python.exe -m pip show alembic uvicorn
```

You should see both packages listed. If either is missing, the install did not
complete — re-run it before continuing.

---

## Step 3 — Configure the environment

```powershell
Copy-Item .env.example .env
```

Open `.env` in your editor and set `SESSION_SECRET`. Generate one:

```powershell
py -3.14 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the output into `.env`, replacing the placeholder value.

**Never commit `.env`** — it holds your local secret (it is in `.gitignore`).

---

## Step 4 — Start the database

```powershell
docker compose up -d --wait
docker ps
```

Two healthy containers: `codelive_postgres` (port 5432) and
`codelive_postgres_test` (port 5433).

Stop them later with `docker compose down`.

---

## Step 5 — Create the database tables

```powershell
cd backend
& ..\.venv\Scripts\python.exe -m alembic upgrade head
cd ..
```

---

## Step 6 — Run the app

```powershell
cd backend
& ..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --no-access-log
```

Open <http://localhost:8000/docs> in your browser. Verify:

```powershell
Invoke-RestMethod http://localhost:8000/api/health
```

Expected: `{"status": "ok", "db": "ok"}`. Stop with `Ctrl+C`.

> **Secure cookie limitation:** the session cookie (`codelive_session`) is
> always `Secure`, so always test through `http://localhost` or
> `http://127.0.0.1` — never through a LAN IP over plain HTTP.

---

## Step 7 — Run the tests

```powershell
& .\.venv\Scripts\python.exe -m pytest backend/app/features -q
& .\.venv\Scripts\python.exe -m pytest backend/tests/integration -q
```

Both should end with `passed`.

---

## Windows quick reference

| Linux/macOS                             | Windows (PowerShell)                                 |
| --------------------------------------- | ---------------------------------------------------- |
| `python3.14`                            | `py -3.14`                                           |
| `.venv/bin/python`                      | `.\.venv\Scripts\python.exe`                         |
| `cp .env.example .env`                  | `Copy-Item .env.example .env`                        |
| `cd backend && cmd`                     | `cd backend` then `cmd` (or `;`)                     |
| `curl http://localhost:8000/api/health` | `Invoke-RestMethod http://localhost:8000/api/health` |
| `docker compose up -d --wait`           | _(unchanged)_                                        |
| `alembic upgrade head`                  | `& ..\.venv\Scripts\python.exe -m alembic upgrade head` (from `backend/`) |
| `uvicorn app.main:app ...`              | `& ..\.venv\Scripts\python.exe -m uvicorn app.main:app ...` (from `backend/`) |

See `docs/TUTORIAL-WINDOWS.pt-BR.md` for the same guide in Portuguese.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| `docker: command not found` | Docker not installed/started | Install and start Docker Desktop |
| `No module named 'alembic'` | Dependencies not installed | Re-run step 2 and verify with `-m pip show alembic uvicorn` |
| `ModuleNotFoundError: No module named 'app'` | Wrong directory | Run tests from the project root, or the server from `backend/` |
| Health check returns `db: unavailable` | Database down | `docker compose up -d --wait` (step 4) |
| You log in but immediately log out | Wrong host | Use `http://localhost:8000`, not a LAN IP (cookie is `Secure`) |
| `pip: command not found` | venv created without pip | Follow step 1's `get-pip.py` bootstrap |
