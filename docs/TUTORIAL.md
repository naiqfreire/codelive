# Tutorial — Linux, macOS or WSL (English)

Follow this guide on **Linux, macOS, or WSL (Ubuntu/Debian)**.

> **On Windows without WSL?** Use the Windows-native walkthrough instead:
> [docs/TUTORIAL-WINDOWS.md](TUTORIAL-WINDOWS.md).

---

## What you need

1. **Python 3.14** — check it:

   ```bash
   python3.14 --version
   ```

   If the command is missing, install Python 3.14 for your OS
   (python.org downloads) and make sure `python3.14` points to it.

2. **Docker** (with Compose v2) — check it:

   ```bash
   docker --version
   docker compose version
   ```

   Start Docker (Docker Desktop on macOS/Windows-with-WSL, or the Docker
   service on Linux) and make sure both commands print a version.
   On WSL, enable Docker Desktop's **WSL integration** for your distribution
   (Settings → Resources → WSL integration).

3. **Git** — install it, then clone the repo:

   ```bash
   git clone <REPO-URL>
   cd codelive
   ```

   Use the repo URL from GitHub/GitLab. The commands below assume you are in
   the project root, where this README lives.

---

## Step 1 — Create the Python environment

Python projects keep their dependencies inside a folder called `.venv`
(a "virtual environment"), so they don't pollute your system Python.

On some Linux images the `pip` tool (the Python package installer) is missing.
If that happens to you, create the venv without pip and then install pip into it:

```bash
python3.14 -m venv --without-pip .venv
curl -o /tmp/get-pip.py https://bootstrap.pypa.io/get-pip.py
.venv/bin/python /tmp/get-pip.py
```

If `python3.14 -m venv .venv` works on your machine, just run that instead —
the result is the same. Check it:

```bash
.venv/bin/python -m pip --version
```

You should see something like `pip 26.x ...`.

From now on, every Python command in this guide uses `.venv/bin/python`,
so you always run the project's own Python with its own packages.

---

## Step 2 — Install the dependencies

```bash
.venv/bin/python -m pip install -r requirements.txt -r requirements-dev.txt
```

- `requirements.txt` — packages the app needs to run.
- `requirements-dev.txt` — extra packages needed only to run the tests.

This downloads everything from PyPI. The first time it can take a minute.

---

## Step 3 — Configure the environment

The app reads five settings from a file called `.env` in the project root.
Create it from the template:

```bash
cp .env.example .env
```

Open `.env` in your editor and set `SESSION_SECRET` to a long random string.
Generate one with Python (no tool needed beyond step 1):

```bash
python3.14 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the output into `.env`, replacing the placeholder value.

**Important:** never commit `.env` to git. It holds your local secret.
That is why it is listed in `.gitignore`.

---

## Step 4 — Start the database

CodeLive uses PostgreSQL, running inside Docker. Start it:

```bash
docker compose up -d --wait
```

This starts two databases:

- `codelive` on port 5432 (the app's database)
- `codelive_test` on port 5433 (used only by the tests)

Check they are up:

```bash
docker ps
```

You should see two containers named `codelive_postgres` and
`codelive_postgres_test`, both `Up` and `healthy`.

To stop them later:

```bash
docker compose down
```

---

## Step 5 — Create the database tables

The schema is managed by **Alembic** (the migration tool). Run the migrations:

```bash
cd backend && ../.venv/bin/alembic upgrade head
```

Go back to the project root afterwards:

```bash
cd ..
```

If a migration fails, read the error message from the bottom up — it usually
tells you the real cause (database not running, wrong `.env`, etc.).

---

## Step 6 — Run the app

```bash
cd backend && ../.venv/bin/uvicorn app.main:app --reload --no-access-log
```

- `uvicorn` is the web server that runs the app.
- `--reload` restarts the server automatically when you edit code.
- `--no-access-log` turns off uvicorn's own access log, because the app
  already writes its own JSON access log lines (`http_request` events).
  That keeps one clean log stream instead of two formats.

Open your browser at <http://localhost:8000/docs> — you should see the
interactive API documentation. The app is ready when that page loads.

Try it out:

```bash
curl http://localhost:8000/api/health
```

You should get:

```json
{"status": "ok", "db": "ok"}
```

Stop the server with `Ctrl+C`.

> **Important limitation:** the login cookie (`codelive_session`) is always
> marked `Secure`, so browsers only accept it over HTTPS — with one exception:
> `http://localhost` and `http://127.0.0.1` count as secure contexts.
> That means: always test the API through `localhost`/`127.0.0.1`.
> Opening it through a LAN IP address over plain HTTP will not keep you logged in,
> because the browser refuses to store the cookie.

---

## Step 7 — Run the tests

Unit tests (fast, no database needed):

```bash
.venv/bin/python -m pytest backend/app/features -q
```

Integration tests (need the database from step 4 running):

```bash
.venv/bin/python -m pytest backend/tests/integration -q
```

Both should end with `passed`. If a test fails, run it again with `-v`
(and without `-q`) to see the full error message.

---

## API endpoints (all under `/api`)

| Method | Path | What it does |
| ------ | ---- | ------------ |
| GET | `/api/health` | Health check (app + database) |
| POST | `/api/auth/register` | Create an account and log in |
| POST | `/api/auth/login` | Log in with email + password |
| POST | `/api/auth/logout` | Log out (clears the cookie) |
| GET | `/api/auth/me` | Who am I? (needs the login cookie) |

Every error response looks like this:

```json
{"error": {"code": "not_authenticated", "message": "Não autenticado.", "request_id": "..."}}
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| `docker: command not found` | Docker not installed/started | Install and start Docker; on WSL enable its WSL integration |
| `ModuleNotFoundError: No module named 'app'` | Wrong directory | Run tests from the project root, or the server from `backend/` |
| Health check returns `db: unavailable` | Database down | `docker compose up -d --wait` (step 4) |
| You log in but immediately log out | Wrong host | Use `http://localhost:8000`, not a LAN IP (cookie is `Secure`) |
| `pip: command not found` | venv created without pip | Follow step 1's `get-pip.py` bootstrap |
