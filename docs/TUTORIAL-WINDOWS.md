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

> **Note:** on Windows, every Python command uses `.venv\Scripts\python.exe`
> instead of the Linux/macOS `.venv/bin/python`. In this guide that program
> is written as `$py` for brevity — set it once:

```powershell
$py = ".\.venv\Scripts\python.exe"
```

---

## Step 1 — Create the Python environment

```powershell
py -3.14 -m venv .venv
& $py -m pip --version
```

You should see `pip 26.x ...`.

(If `python3.14 -m venv` complains about a missing `ensurepip`, skip it and
bootstrap pip, exactly as in the main README:

```powershell
Invoke-WebRequest -Uri https://bootstrap.pypa.io/get-pip.py -OutFile $env:TEMP\get-pip.py
& $py $env:TEMP\get-pip.py
```

)

---

## Step 2 — Install dependencies

```powershell
& $py -m pip install -r requirements.txt -r requirements-dev.txt
```

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
& ..\.venv\Scripts\alembic.exe upgrade head
cd ..
```

---

## Step 6 — Run the app

```powershell
cd backend
& ..\.venv\Scripts\uvicorn.exe app.main:app --reload --no-access-log
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
& $py -m pytest backend/app/features -q
& $py -m pytest backend/tests/integration -q
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

See `docs/TUTORIAL-WINDOWS.pt-BR.md` for the same guide in Portuguese.
