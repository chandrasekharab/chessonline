# ♟ Chess Insight Engine

A production-ready multi-user web platform that automatically analyses chess games using the Stockfish engine — detecting blunders, mistakes, inaccuracies, and missed winning moves.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Backend API | Node.js + Express + TypeScript |
| Analysis Worker | BullMQ worker + Stockfish UCI |
| Database | PostgreSQL 16 |
| Queue / Cache | Redis 7 |
| Engine | Stockfish (latest stable) |
| Containerisation | Docker + Docker Compose |

---

## Project Structure

```
chessplatform/
├── backend/
│   ├── src/
│   │   ├── config/           # DB, Redis, env loading
│   │   ├── controllers/      # auth, games (request/response)
│   │   ├── middleware/       # JWT auth, error handler, rate limiting
│   │   ├── queue/            # BullMQ analysis queue
│   │   ├── repositories/     # DB query layer (users, games, analysis)
│   │   ├── routes/           # Express routers
│   │   ├── services/         # Business logic (auth, games, analysis, engine)
│   │   ├── types/            # Shared TypeScript types
│   │   ├── utils/            # logger, PGN parser, move classifier
│   │   ├── workers/          # BullMQ analysis worker (separate process)
│   │   ├── app.ts            # Express app setup
│   │   └── server.ts         # HTTP server entry point
│   ├── db/
│   │   └── schema.sql        # PostgreSQL DDL
│   ├── Dockerfile
│   ├── Dockerfile.worker
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/         # Login, Register
│   │   │   ├── common/       # Navbar, ProtectedRoute
│   │   │   ├── dashboard/    # Dashboard (game list + upload)
│   │   │   ├── game/         # GameUpload, GameList, GameView
│   │   │   └── analysis/     # ChessBoard, EvaluationBar, MoveList, Summary
│   │   ├── services/         # Axios API client
│   │   ├── store/            # Zustand auth store
│   │   ├── types/            # Shared frontend types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```

---

## Quick Start (Docker)

### Prerequisites

- Docker ≥ 24
- Docker Compose ≥ 2

### 1. Clone and configure

```bash
git clone <repo-url> chessplatform
cd chessplatform
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set a strong `JWT_SECRET`.

### 2. Launch all services

```bash
docker compose up --build
```

Services started:
- **Frontend**: http://localhost:8001
- **Backend API**: http://localhost:8000
- **PostgreSQL**: localhost:7432
- **Redis**: localhost:7379

The database schema is applied automatically on first boot via the init script.

---

## Local Development (without Docker)

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Stockfish installed on your system

macOS: `brew install stockfish`  
Ubuntu: `sudo apt install stockfish`

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your local DB/Redis URLs and Stockfish path

# Apply schema
psql $DATABASE_URL -f db/schema.sql

# Start API server (development mode with hot reload)
npm run dev

# Start analysis worker in a separate terminal
npm run worker
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server: http://localhost:5173 (proxies API calls to backend on port 7000)

---

## API Reference

### Authentication

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | `{ email, password }` | Register new user |
| POST | `/auth/login` | `{ email, password }` | Login, returns JWT |
| GET | `/auth/me` | — | Current user info (auth required) |

### Games

All game endpoints require `Authorization: Bearer <token>`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/games` | List all user's games |
| POST | `/games` | Create game from PGN text |
| POST | `/games/upload` | Upload .pgn file |
| GET | `/games/:id` | Get game details |
| DELETE | `/games/:id` | Delete game |
| POST | `/games/:id/analyze` | Trigger analysis (async) |
| GET | `/games/:id/analysis` | Fetch analysis results |

### Analysis Response Shape

```json
{
  "game": { "id": "...", "status": "completed", "metadata_json": {...} },
  "moves": [
    {
      "move_number": 1,
      "move": "e4",
      "fen": "...",
      "eval_before": 20,
      "eval_after": 20,
      "eval_diff": 0,
      "label": "good",
      "best_move": "e4",
      "explanation": null
    }
  ],
  "summary": { "good": 30, "inaccuracy": 3, "mistake": 1, "blunder": 0 }
}
```

---

## Move Classification Logic

Evaluations are in centipawns (cp). The drop is calculated from the moving side's perspective.

| Drop (cp) | Label |
|-----------|-------|
| ≥ 200 | Blunder (`??`) |
| ≥ 100 | Mistake (`?`) |
| ≥ 50 | Inaccuracy (`?!`) |
| < 50 | Good |
| Improvement ≥ 50 | Excellent (`!`) |

**Missed Win**: Engine eval ≥ +500 before move AND drops below +200 after move.

---

## Configuration

All configuration is via environment variables. See `backend/.env.example` for the full list.

Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `ENGINE_DEPTH` | `18` | Stockfish search depth |
| `ENGINE_MAX_CONCURRENT` | `2` | Max simultaneous engine processes |
| `STOCKFISH_PATH` | `/usr/games/stockfish` | Path to Stockfish binary |
| `JWT_SECRET` | *(required)* | Secret for JWT signing |
| `ANALYSIS_RATE_LIMIT_MAX` | `10` | Max analyses per user per 15 min |

---

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT-based stateless authentication
- Rate limiting on all endpoints (global + per-analysis)
- PGN input validated before processing
- File size limited (default 5 MB)
- Helmet.js security headers
- Engine process pool prevents resource exhaustion
- All secrets via environment variables

---

## Scaling

- The **worker** container can be scaled independently: `docker compose up --scale worker=4`
- Engine concurrency per worker is controlled by `ENGINE_MAX_CONCURRENT`
- BullMQ handles distributed job coordination via Redis
- PostgreSQL connection pooling (pg Pool, max 20 connections)

---

## Roadmap / Optional Enhancements

- [ ] AI explanations via OpenAI (stub ready in `analysis.service.ts`)
- [ ] Opening explorer integration (ECO codes present in metadata)
- [ ] Opponent analysis comparison
- [ ] WebSocket live analysis updates
- [ ] PGN export with annotations
- [ ] Multi-game aggregate statistics

---

## License

MIT
