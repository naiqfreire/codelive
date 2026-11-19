<div align="center">
  
# CodeLive
  
### Plataforma de compartilhamento de código ao vivo

[Inglês](README.md) · **Português**

</div>

---

## 📖 Sobre o projeto

O **CodeLive** é uma plataforma web que permite a usuários autenticados criarem salas de código com acesso por código único.

O dono da sala edita o código em tempo real, enquanto outros usuários entram como espectadores e visualizam a evolução do código em modo somente leitura. A plataforma conta com destaque de sintaxe, atualização automática instantânea e histórico de versões, sendo ideal para estudantes, professores e qualquer pessoa que queira compartilhar código de forma prática e ao vivo.

## 🚀 Como rodar localmente

Tutoriais passo a passo para configurar e rodar o projeto na sua máquina:

- **Linux, macOS ou WSL:** [docs/TUTORIAL.pt-BR.md](docs/TUTORIAL.pt-BR.md) (Português) · [docs/TUTORIAL.md](docs/TUTORIAL.md) (English)
- **Windows (nativo):** [docs/TUTORIAL-WINDOWS.pt-BR.md](docs/TUTORIAL-WINDOWS.pt-BR.md) (Português) · [docs/TUTORIAL-WINDOWS.md](docs/TUTORIAL-WINDOWS.md) (English)

## 🐳 Rodar tudo com Docker

Requisitos: Docker Desktop (Windows/macOS) ou Docker Engine com Compose.

```bash
cp .env.example .env      # só na primeira vez: defina o SESSION_SECRET
docker compose up --build
```

Abra <http://localhost:8080>. Um único comando sobe o PostgreSQL, aplica as
migrações do Alembic, roda a API e serve a SPA já compilada pelo nginx na mesma
origem, então o cookie de sessão e o WebSocket da sala funcionam exatamente como
no ambiente de desenvolvimento.

```bash
docker compose up -d --wait   # mesma stack, em segundo plano
docker compose logs -f backend
docker compose down           # para tudo e mantém o volume do banco
docker compose down -v        # para tudo e apaga o volume do banco
bash scripts/smoke-docker.sh       # smoke test: SPA, proxy /api e upgrade do WebSocket
```

O banco dos testes de integração é opcional e também precisa do profile para ser
encerrado: `docker compose --profile test up -d --wait postgres_test` para subir,
`docker compose --profile test down -v` para remover tudo.

Os tutoriais acima continuam sendo o caminho para rodar a aplicação nativamente,
com reload do backend e o servidor de desenvolvimento do Vite.

## 🖥️ Frontend

Requisitos: Node.js 20+ e npm.

```bash
cd frontend
npm ci
npm run dev
```

Outros scripts: `npm run build`, `npm run lint`, `npm run format`, `npm run format:check`, `npm run typecheck`, `npm run test`.

## 👥 Contribuidores

- [Naiaque Freire](https://github.com/naiqfreire)
- [Yan Yasser](https://github.com/y4sse)
- [Antonio de Jesus Ferreira Barbosa](https://github.com/NyanTony)
