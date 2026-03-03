# Chess Insight Engine — Architecture

## Overview

Chess Insight Engine is a full-stack, multi-user web platform that accepts chess games in PGN format and automatically classifies every move (blunder, mistake, inaccuracy, excellent, etc.) by running each position through the Stockfish engine at depth 18.

```
Browser (React/Vite)
       │  HTTP / JSON
       ▼
  nginx:alpine  ──proxy /auth, /games──►  Express API  (Node 20)
                                               │         │
                                        PostgreSQL 16   Redis 7
                                               │         │
                                         BullMQ queue ◄─┘
                                               │
                                        Analysis Worker (Node 20)
                                               │
                                         Stockfish UCI
```

---

## Services

| Container | Image | Host Port | Purpose |
|---|---|---|---|
| `chess_frontend` | `nginx:alpine` | **8001** | Serves React SPA; proxies `/auth` and `/games` to backend |
| `chess_backend` | `node:20-slim` | **8000** | REST API — auth, game CRUD, job dispatch |
| `chess_worker` | `node:20-slim` | — | BullMQ worker; runs Stockfish per game |
| `chess_postgres` | `postgres:16-alpine` | 7432 | Persistent game + analysis storage |
| `chess_redis` | `redis:7-alpine` | 7379 | BullMQ job queue broker |

---

## Repository Layout

```
chessplatform/
├── docker-compose.yml
├── .env.example
├── ARCHITECTURE.md
├── USAGE.md
│
├── backend/
│   ├── Dockerfile              # API server image (multi-stage)
│   ├── Dockerfile.worker       # Analysis worker image (multi-stage)
│   ├── db/
│   │   └── schema.sql          # PostgreSQL DDL (auto-applied on first boot)
│   ├── scripts/
│   │   └── seed.ts             # Sample-data seeder
│   └── src/
│       ├── server.ts           # Entry point — binds HTTP server
│       ├── app.ts              # Express app factory (middleware, routes)
│       ├── config/
│       │   ├── database.ts     # pg.Pool singleton
│       │   ├── env.ts          # Validated env-var config
│       │   └── redis.ts        # IORedis client + plain opts for BullMQ
│       ├── controllers/
│       │   ├── auth.controller.ts
│       │   └── games.controller.ts
│       ├── middleware/
│       │   ├── auth.middleware.ts       # JWT verification
│       │   ├── error.middleware.ts      # Centralised error handler
│       │   └── rateLimit.middleware.ts  # express-rate-limit (analysis endpoint)
│       ├── queue/
│       │   └── analysisQueue.ts        # BullMQ Queue definition
│       ├── repositories/
│       │   ├── user.repository.ts
│       │   ├── game.repository.ts
│       │   └── analysis.repository.ts
│       ├── routes/
│       │   ├── auth.routes.ts
│       │   └── games.routes.ts
│       ├── services/
│       │   ├── auth.service.ts         # bcrypt + JWT logic
│       │   ├── games.service.ts        # Game CRUD orchestration
│       │   ├── analysis.service.ts     # PGN replay + Stockfish pipeline
│       │   └── engine.service.ts       # Stockfish UCI process pool
│       ├── types/
│       │   └── index.ts                # Shared domain types
│       ├── utils/
│       │   ├── classification.ts       # Move-label thresholds
│       │   ├── logger.ts               # Winston logger
│       │   └── pgn.parser.ts           # chess.js PGN → FEN list
│       └── workers/
│           └── analysis.worker.ts      # Standalone BullMQ worker process
│
└── frontend/
    ├── Dockerfile              # React build → nginx:alpine
    ├── nginx.conf              # SPA fallback + API proxy
    ├── vite.config.ts
    └── src/
        ├── App.tsx             # Router + query-client setup
        ├── main.tsx
        ├── services/
        │   └── api.ts          # Axios instance with auth interceptor
        ├── store/
        │   └── authStore.ts    # Zustand auth state
        ├── types/
        │   └── index.ts
        └── components/
            ├── auth/           # Login, Register
            ├── common/         # Navbar, ProtectedRoute
            ├── dashboard/      # Dashboard (game list overview)
            ├── game/           # GameList, GameUpload, GameView
            └── analysis/       # ChessBoard, EvaluationBar, MoveList, AnalysisSummary
```

---

## Database Schema

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `uuid_generate_v4()` |
| `email` | VARCHAR(255) UNIQUE | |
| `password_hash` | TEXT | bcrypt, 12 rounds |
| `created_at` | TIMESTAMPTZ | |

### `games`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | CASCADE delete |
| `pgn` | TEXT | Raw PGN string |
| `metadata_json` | JSONB | event, white, black, result, eco, dates |
| `status` | VARCHAR(20) | `uploaded` → `analyzing` → `completed` / `failed` |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-updated by trigger |

### `analysis`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `game_id` | UUID FK → games | CASCADE delete |
| `move_number` | INTEGER | 1-based |
| `move` | VARCHAR(20) | SAN notation (e.g. `Nf6`) |
| `fen` | TEXT | Position after the move |
| `eval_before` | NUMERIC(8,2) | Centipawns (white perspective) before move |
| `eval_after` | NUMERIC(8,2) | Centipawns after move |
| `eval_diff` | NUMERIC(8,2) | `eval_before − eval_after` |
| `label` | VARCHAR(30) | One of the seven labels below |
| `best_move` | VARCHAR(20) | Stockfish top choice in UCI notation |
| `explanation` | TEXT | Optional narrative |
| `created_at` | TIMESTAMPTZ | |

---

## Move Classification

Evaluation is always normalised to the **moving side's perspective** before comparison.

| Label | Condition |
|---|---|
| `missed_win` | eval_before ≥ +500cp AND eval_after < +200cp |
| `blunder` | drop ≥ 200 cp |
| `mistake` | drop ≥ 100 cp |
| `inaccuracy` | drop ≥ 50 cp |
| `good` | −50 cp < drop < 50 cp |
| `excellent` | drop ≤ −50 cp (significantly better than engine) |
| `best` | reserved for engine-confirmed best move |

Mate scores are converted to ±30 000 cp (capped) using: `sign × (30000 − |mateIn| × 10)`.

Evaluations are clamped to **±1 500 cp** for display.

---

## Analysis Pipeline

```
POST /games/:id/analyze
        │
        ▼
  BullMQ: enqueueAnalysis()
        │ (job: { gameId, userId, depth })
        ▼
  Analysis Worker (separate process)
        │
        ├─ parsePgn()            → list of { move, fenBefore, fenAfter }
        │
        ├─ for each move:
        │   ├─ engineService.evaluate(fenBefore, depth)  → evalBefore
        │   ├─ engineService.evaluate(fenAfter,  depth)  → evalAfter
        │   └─ classifyMove(evalBefore, evalAfter, isWhite) → label
        │
        ├─ AnalysisRepository.insertBatch()  → bulk INSERT into analysis table
        │
        └─ GameRepository.updateStatus('completed')
```

The engine service maintains a **pool of N Stockfish processes** (`ENGINE_MAX_CONCURRENT`, default 2). Each call to `evaluate()` acquires a process, sends `position fen … / go depth N`, parses the `bestmove` and `score cp / score mate` tokens from `info` lines, and releases the process back to the pool.

---

## Authentication

- **Registration**: password hashed with bcrypt (12 rounds), user row inserted, JWT returned.
- **Login**: bcrypt compare, JWT returned.
- **JWT**: HS256, payload `{ userId, email }`, default expiry 7 days.
- **Protected routes**: `Authorization: Bearer <token>` header validated by `requireAuth` middleware on every `/games` request.

---

## Key Technology Choices

| Concern | Choice | Reason |
|---|---|---|
| Engine | Stockfish (apt) | Free, strongest open-source engine; UCI protocol |
| Queue | BullMQ + Redis | Durable jobs, retry logic, separate worker process |
| ORM | Raw `pg` queries | Full SQL control, no N+1 risk |
| Auth | JWT (stateless) | Horizontally scalable; no session store needed |
| Frontend state | Zustand + React Query | Minimal boilerplate; server-state caching |
| Build | Vite + tsc | Fast HMR in dev; strict type checking |
| Container | Docker multi-stage | Minimal runtime image; BuildKit npm cache |
