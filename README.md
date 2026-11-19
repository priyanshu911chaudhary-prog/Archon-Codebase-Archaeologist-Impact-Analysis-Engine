# Archon

Codebase archaeologist and blast-radius impact-analysis engine for TypeScript/JavaScript repositories.

Archon strictly separates **deterministic structural truth** (AST-extracted `IMPORTS` and `CALLS` dependency graphs) from **semantic reasoning** (citation-grounded Gemini AI risk reports).

## Workspace Structure

- `apps/web` — Next.js App Router interactive architecture map & inspector UI
- `apps/api` — Fastify REST API (ingestion validation, blast radius queries, AI risk reports)
- `apps/worker` — BullMQ async worker (ephemeral shallow clone, forked AST parser, embeddings)
- `packages/core` — Pure static analysis & dependency graph extraction engine
- `packages/shared` — Shared schemas, typed errors, env validation, and structured logging

## Prerequisites

- Node.js 24 LTS (see `.nvmrc`)
- npm 11+
- Docker Desktop (Linux containers / WSL2 backend on Windows)

## Quick Start (Windows PowerShell)

```powershell
Copy-Item .env.example .env
npm install
npm run docker:up
npm run format:check
npm run lint
npm run typecheck
npm test
```
