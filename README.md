# Minimi Web Search Agent

TypeScript monorepo built with npm workspaces, Next.js, Fastify, and PostgreSQL.

## Workspace Structure

- `apps/web` — Next.js frontend
- `apps/api` — Fastify backend (`src/routes`, `src/plugins`, `src/services`, `src/server.ts`)
- `packages/agent` — AI web search agent
- `packages/db` — PostgreSQL client and schema helpers
- `packages/shared` — Shared TypeScript types and Zod validation schemas

## Getting Started

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
2. Start PostgreSQL (optional for initial scaffold):
   ```bash
   docker compose up -d
   ```
3. Install dependencies and build workspace packages:
   ```bash
   npm install
   npm run build:packages
   ```
4. Run development servers:
   ```bash
   npm run dev
   ```

