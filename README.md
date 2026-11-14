# Minimi Web Search Agent

A fast, accurate conversational AI agent with real-time web search and bitemporal hybrid memory (PostgreSQL + Drizzle ORM).

Built for the **Minimi AI Engineering Challenge**.

---

## Architecture Highlights

- **Single Tool Agent:** Exposes strictly one tool to the LLM: `web_search` (powered by Tavily).
- **Pre-Flight Temporal Memory Router:** Automatically resolves relative dates (e.g. *"on Monday"*, *"last Tuesday"*, *"3 November"*) and searches past conversation turns via exact date indexing and Postgres GIN full-text search before calling the main agent.
- **Parallel Search Execution:** Executes concurrent `web_search` queries via `Promise.all` when verifying multiple entities at once.
- **Non-Blocking Write Path:** Writes conversation turns immediately to PostgreSQL while running entity and topic extraction asynchronously in the background.
- **Zero-Friction Setup:** Automatic database schema and index initialization on startup (`initDb()`).

For detailed architectural decisions and trade-offs, see [DESIGN.md](./DESIGN.md).

---

## Quickstart

### 1. Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0
- PostgreSQL database (or Docker)

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```

Required keys:
- `OPENAI_API_KEY`: OpenAI API key (for `gpt-4o-mini`)
- `TAVILY_API_KEY`: Tavily search API key
- `DATABASE_URL`: PostgreSQL connection string (e.g., Neon or local Postgres)

*(Optional) If using Docker for local Postgres:*
```bash
docker compose up -d
```

### 3. Install & Start Development Servers
```bash
npm install
npm run dev
```

The app will start:
- **Web Frontend:** [http://localhost:3000](http://localhost:3000)
- **API Server:** [http://localhost:3001](http://localhost:3001) (with automatic DB schema initialization)

---

## Project Structure

```
minimi_web_search_agent/
├── apps/
│   ├── api/          # Fastify API server with memory router & Drizzle ORM
│   └── web/          # Next.js chat interface
├── packages/
│   ├── agent/        # OpenAI LLM agent with parallel web_search tool execution
│   └── shared/       # Shared TypeScript types
├── DESIGN.md         # Architecture design, trade-offs, and roadmap
└── docker-compose.yml# Local PostgreSQL with pgvector
```

---

## Available Scripts

- `npm run dev`: Starts both backend (`@minimi/api`) and frontend (`@minimi/web`) concurrently.
- `npm run build`: Builds all packages and apps.
- `npm run typecheck`: Runs TypeScript type checking across all workspaces.
- `npm run db:push`: Pushes Drizzle ORM schema to the PostgreSQL database.
