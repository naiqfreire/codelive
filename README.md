<div align="center">
  
# CodeLive
  
### Live code sharing platform

**English** · [Portuguese](README.pt-BR.md)

</div>

---

## 📖 About the project

**CodeLive** is a web platform that allows authenticated users to create code rooms with unique access codes.

The room owner edits the code in real-time, while spectators join to watch the code evolution in a read-only mode. The platform features syntax highlighting, instant auto-update, and version history, making it ideal for students, teachers, and anyone who wants to share code live and easily.

## 🚀 How to run it locally

Step-by-step tutorials to set up and run the project on your machine:

- **Linux, macOS or WSL:** [docs/TUTORIAL.md](docs/TUTORIAL.md) (English) · [docs/TUTORIAL.pt-BR.md](docs/TUTORIAL.pt-BR.md) (Português)
- **Windows (native):** [docs/TUTORIAL-WINDOWS.md](docs/TUTORIAL-WINDOWS.md) (English) · [docs/TUTORIAL-WINDOWS.pt-BR.md](docs/TUTORIAL-WINDOWS.pt-BR.md) (Português)

## 🐳 Run everything with Docker

Requirements: Docker Desktop (Windows/macOS) or Docker Engine with Compose.

```bash
cp .env.example .env      # first run only: set SESSION_SECRET
docker compose up --build
```

Open <http://localhost:8080>. A single command starts PostgreSQL, applies the
Alembic migrations, runs the API and serves the built SPA through nginx on one
origin, so the session cookie and the room WebSocket behave exactly as they do
in development.

```bash
docker compose up -d --wait   # same stack, detached
docker compose logs -f backend
docker compose down           # stop, keep the database volume
docker compose down -v        # stop and delete the database volume
bash scripts/smoke-docker.sh       # smoke test: SPA, /api proxy, WebSocket upgrade
```

The integration-test database is opt-in and needs the profile to be stopped
too: `docker compose --profile test up -d --wait postgres_test` to start it,
`docker compose --profile test down -v` to remove everything.

The tutorials above remain the way to run the app natively, with backend
reload and the Vite dev server.

## 🖥️ Frontend

Requirements: Node.js 20+ and npm.

```bash
cd frontend
npm ci
npm run dev
```

Other scripts: `npm run build`, `npm run lint`, `npm run format`, `npm run format:check`, `npm run typecheck`, `npm run test`.

## 👥 Contributors

- [Naiaque Freire](https://github.com/naiqfreire)
- [Yan Yasser](https://github.com/y4sse)
- [Antonio de Jesus Ferreira Barbosa](https://github.com/NyanTony)
