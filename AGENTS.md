# AGENTS.md

## Source of truth

Respect this order of precedence:

1. `AGENTS.md`.
2. `docs/SPEC.md` for the canonical public system definition: requirements (RF/RNF), architecture, data model, API, authorization, and observability. `SPEC.md` is public and written in Portuguese.
3. `docs/DESIGN_SYSTEM.md` for the frontend visual contract: design tokens, typography, spacing, focus/error/loading states, motion, and accessibility. Every frontend change must read and follow it.
4. `.agents/skills/` for task-specific agent instructions. A skill never overrides `AGENTS.md`.
5. Existing code and tests for current behavior.

If two sources conflict, stop and ask. For any non-trivial decision (architecture, dependencies, security, caching, scope), present options, trade-offs (complexity, deadline, security, RF/RNF impact, reversibility), and one recommendation; wait for explicit approval. Do not choose silently.

## Skills

`.agents/skills` holds reusable instructions for agents. Before starting a task:

1. Read `.agents/skills/README.md`.
2. Match the user's context with skill.
3. If no skill matches, continue with `AGENTS.md` and the relevant spec.
4. If two skills conflict, stop and ask.

Skills add task-specific guidance. They do not replace `AGENTS.md`, the specs, or the tests.

## Fixed decisions

- Backend: Python 3.14.10, FastAPI, SQLAlchemy, Alembic, and PostgreSQL.
- Frontend: React + TypeScript + Vite + npm SPA, TailwindCSS, and CodeMirror 6.
- Communication: REST for authentication and CRUD. WebSocket for live code and presence.
- Architecture: Vertical Slice Architecture. One slice per feature.
- Supported languages: Python, Java, C, PHP and JavaScript.
- SPA: React Router, route-level code splitting, and CodeMirror loaded on demand.
- Frontend deployment: static files with fallback to `index.html` for deep routes.
- Authentication: session token in an `httpOnly`, `Secure`, `SameSite=Lax` cookie. Never use `localStorage`.
- Passwords: argon2id. Never use plain `hashlib`, MD5, or SHA for passwords.
- Anonymous spectator: signed anonymous session, no email, no registration.
- Current code: `room_code_state` table, owned by the `live_code` slice.
- Versions: immutable. Restoring writes a new current state and creates a new version.
- Retention: delete versions older than 30 days, except the most recent version of each room.
- Caching: `cachetools` in-memory on the backend; TanStack Query with `localStorage` persistence on the frontend. No distributed cache in the MVP.
- Tests: pytest for the backend, Vitest for the frontend, Playwright for full flows, and k6 for load.
- Backend dependencies (authorized 2026-11-05): uvicorn[standard], sqlalchemy[asyncio], psycopg[binary], alembic, pydantic-settings, python-dotenv, argon2-cffi, itsdangerous, structlog, email-validator; tests: pytest, pytest-asyncio, httpx.
- Frontend dependencies (authorized 2026-11-07, task #5): react, react-dom, vite, @vitejs/plugin-react, typescript, tailwindcss, postcss, autoprefixer; tests: vitest, jsdom, @testing-library/react, @testing-library/jest-dom, @testing-library/dom; tooling: eslint, @eslint/js, typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-react-refresh, eslint-config-prettier, globals, prettier. Additional frontend dependency (authorized 2026-11-07, task #11): react-router-dom ^7 (upgraded from ^6 in PR #9, together with vite ^8 and vitest ^5). CodeMirror 6 (authorized 2026-11-08, task #33): @codemirror/state, @codemirror/view, @codemirror/language, @codemirror/commands, @codemirror/lang-python, @codemirror/lang-java, @codemirror/lang-javascript, @codemirror/lang-php, @codemirror/lang-cpp, @lezer/highlight.
- Browsers: current versions of Chrome, Firefox, and Edge.
- Systems: Windows and Linux.
- Tools: free and open-source only.

## Architecture rules

- Organize the backend and frontend by feature, not by global technical layer.
- Each slice contains its route, schemas, service, models, migration, and tests.
- Another slice imports only `public.py`, never internal modules.
- The `shared/` kernel contains configuration, database session, security, errors, authorization policy, and the WebSocket hub.
- Composition between slices happens in `app/main.py` on the backend and in the router under `frontend/src/app`.
- A new feature creates a new folder under `features/`. Do not put feature rules in `shared/`.
- Add code to `shared/` only when two or more slices use the same code.
- A frontend feature never imports another feature's internal modules. Use `shared/` or the other feature's public API.
- Slice composition rules (operations exposed only through `public.py`; thin routers; business rules in the service; front-end HTTP calls in `api.ts`) live in `docs/SPEC.md` section 5. Read it before adding or modifying a slice.

## Data ownership

| Slice        | Tables            | Responsibility                                       |
| ------------ | ----------------- | ---------------------------------------------------- |
| `auth`       | `users`           | registration, login, and session                     |
| `rooms`      | `rooms`           | owner, access code, language, and status             |
| `membership` | `room_members`    | entry, nickname, anonymous session, and joined rooms |
| `live_code`  | `room_code_state` | current code, WebSocket connections, and broadcast   |
| `versions`   | `code_versions`   | snapshots, retention, and restore                    |

A slice reads data from another slice through the owner slice's `public.py`. Never access another slice's table directly.

## Security

- Hash passwords with argon2id.
- Generate access codes with the `secrets` module and check for collisions.
- Store secrets in environment variables. Commit only `.env.example`.
- Local development uses `.env` (gitignored). CI/CD and deploy use GitHub Secrets or the deployment platform's environment variables. Never commit `.env` or any real secret. If a secret is ever committed, rotate it immediately.
- Restrict CORS to the frontend origin.
- Use 401 for missing authentication, 403 for a forbidden role, 404 for a missing resource, and 409 for a duplicate email or code.
- Never return `password_hash`.
- Never log passwords, tokens, or cookies.
- Limit the code content size.
- Treat CodeMirror read-only mode as interface only. The server enforces the rule.
- Validate the origin of state-changing requests.

## Frontend rules

- Before any frontend change, read `docs/DESIGN_SYSTEM.md`. All frontend work (pages, components, focus/error/loading states, typography, colors, motion, and accessibility) must follow it. Use semantic tokens; never hardcode hexadecimal colors outside the token or theme files.
- Use TypeScript in strict mode. Do not use `any` without justification.
- Centralize HTTP calls in `src/features/*/api.ts`.
- Keep authentication state in a context.
- Protect private routes and redirect visitors to login.
- Use `editable: false` in the spectator's CodeMirror and reconnect with backoff.
- Sync the editor with the `snapshot` after reconnection.
- Use Tailwind color tokens. Do not scatter hexadecimal colors through the code.
- Modals need a label, visible focus, and keyboard dismissal.
- Test the spectator's 4-step flow, owner editing, and version restore.

## Backend rules

- Routers call services. Services call models and repositories.
- Use Pydantic schemas for input and output.
- Every schema change requires an Alembic migration. Never edit an applied migration.
- Use a transaction when updating `room_code_state` and creating a snapshot.
- Keep a WebSocket connection manager indexed by room.
- Run the snapshot job every 30 seconds and discard identical content.
- Test authorization for owner, spectator, and anonymous users.
- Use `structlog` (or the standard logger with a JSON formatter) for every log. No `print`. Include `request_id` in every log entry.

## TDD is mandatory

Every change follows **failing test first -> implement -> verify**:

1. Write the test(s) that capture the desired behavior and watch them **fail** (red).
2. Implement the minimum to make them pass.
3. Run and confirm green.

Don't write implementation before a failing test exists. When fixing a bug, reproduce it with a failing test first.

## Execution pacing

Implement at most **one slice** (one feature/context) per uninterrupted run —
for example, the complete `features/auth/` slice (router, schemas, service,
models, public, tests). Do not implement all features quickly in a single run.

When a slice is finished and verified (tests and build green), the agent
**must stop** and present the slice's commit series:

- One commit per independent file;
- Files with a real dependency between them (e.g. a router importing a
  service, or a test importing the module it exercises) go in the **same
  commit**, in chronological/dependency order;
- A file changed in two different plans gets one commit per change, in plan
  order;
- For each commit: the `git diff` (or exact list of files), the proposed
  message (Conventional Commits + task id), and the test/build output.

Then it must ask for **explicit authorization to continue**. An authorization
("continue", "proceed", "yes") covers **only the next unit** — after finishing
it, the agent stops again and asks for a new authorization. Finishing a slice
never authorizes starting the next one. This applies to single features, bug
fixes, and docs alike.

## Contributors

- When starting work on the project, ask your user for their **full name** and **GitHub profile URL**.
- Add the contributor to `README.md` and `README.pt-BR.md` with the same entry, in the same commit.
- Never guess or infer a name or handle.

## Commit discipline

Branch model:

```text
main <- PR <- develop <- PR <- <type>/<issue_number-short-description>
```

- `main` is the release branch. Only PRs from `develop` reach it.
- `develop` is the integration branch. All feature work merges here first.
- `<type>/<issue_number-short-description>` is the working branch.
- Allowed types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test` and `ci`.
- Use a short, lowercase, hyphenated description in Portuguese.
- Before implementing, sync and branch.

`develop` must exist on `origin`. If it does not, stop and ask the user to create it. Never create or push a remote branch.

The agent may run read-only inspection (`git status`, `git diff`, `git log`, `git branch`, `git remote -v`), synchronization (`git fetch`, `git pull`), and branch work (`git checkout`, `git switch`, `git checkout -b`).

Commits are the user's responsibility. The agent never runs `git commit`, `git push`, `git merge`, `git rebase` on shared branches, or any command that opens or edits a PR. Instead, the agent proposes a commit message and the exact list of files to stage.

Branch names use a short, lowercase, hyphenated Portuguese description. Commit messages follow Conventional Commits: type and scope in English, description in Portuguese, and the Taiga task id at the end (e.g., `feat(backend): adiciona entidade user (#4)`).

A single task may require multiple atomic commits. Every commit must reference the task id it belongs to. The agent must present the diff, the proposed message, and the task id before any commit.

## Commands

Verify each command in the repository before documenting it as final. If a command does not exist, create it in the same change and update this file and `README.md` (All languages).

Backend:

```bash
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt -r requirements-dev.txt
.venv/bin/python -m uvicorn app.main:app --reload
.venv/bin/python -m pytest backend/app/features
.venv/bin/python -m pytest backend/tests/integration
.venv/bin/python -m alembic upgrade head
```

Frontend:

```bash
npm ci
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
```

Load:

```bash
k6 run loadtest/rooms.js
```

## Quality gates

- Every new or fixed behavior has a test.
- A bugfix starts with a failing test.
- Run tests, lint, typecheck, and build before declaring completion.
- Test authorization for owner, authenticated spectator, and anonymous user.
- Run an end-to-end test: owner creates the room, spectator joins, owner edits, spectator receives the update, owner restores a version.
- Run the load test with 2 rooms x 30 spectators. Verify propagation within 5 seconds and no lost updates.
- Smoke test in Chrome, Firefox, and Edge.
- Report command output. Do not claim success without evidence.
- Observability in the MVP means: structured JSON logs, `GET /api/health`, and a correlation ID per request. Do not add metrics, dashboards, traces, alerts, or external uptime monitoring until the user explicitly moves the project to phase 2.
- Front-end logging: capture `window.onerror`, `unhandledrejection`, failed HTTP calls, and `snapshot`/`code_update` receipt in structured console logs including `timestamp` and `request_id`.

## Completion Report

After completing a task, report:

- Summary of the behavior changed
- Modified files
- Important implementation decisions taken with the user and their trade-offs
- Test and build results
- Acceptance criteria status
- Assumptions
- Known limitations
- Remaining risks

## Prohibitions

- Do not invent endpoints, tables, commands, or environment variables.
- Do not weaken authorization to make a test pass.
- Do not store tokens in `localStorage`.
- Do not implement caching that compromises the 5-second propagation requirement (RNF02). Cache only non-real-time data (e.g., room metadata, version lists) and invalidate it explicitly on mutations.
- Do not edit applied migrations.
- Do not add a dependency without authorization and a note in this file.
- Do not implement beyond the cited task.
- Do not commit secrets.
- Do not run `git commit`, `git push`, `git merge`, `git rebase` on shared branches, or open a PR. Propose the commit instead.
- Do not implement without explicit authorization (e.g. yes, proceed).
- Do not make non-trivial decisions without options, trade-offs, and a recommendation.
