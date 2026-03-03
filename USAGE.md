# Chess Insight Engine — Usage Guide

## Quick Start

### 1. Prerequisites
- Docker Desktop 4+ with BuildKit enabled  
- Ports **8000** and **8001** free on your host

### 2. Start the stack

```bash
git clone <repo> chessplatform
cd chessplatform

# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env       # set JWT_SECRET here

# Build and start all services
DOCKER_BUILDKIT=1 docker compose up --build -d
```

Services start in order: postgres → redis → backend + worker → frontend.  
Wait ~15 s for postgres and redis health checks to pass.

```bash
# Verify everything is running
docker compose ps

# Check backend health
curl http://localhost:8000/health
# → {"status":"ok","env":"production"}
```

### 3. Seed sample users

```bash
docker compose exec backend npx ts-node --skip-project \
  --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  scripts/seed.ts
```

This creates three users with pre-loaded classic games:

| Email | Password | Games loaded |
|---|---|---|
| `alice@chess.dev` | `ChessAlice2024!` | Immortal Game, Kasparov–Topalov, Scholar's Mate |
| `bob@chess.dev` | `ChessBob2024!` | Opera Game, Fischer–Spassky, Ruy Lopez |
| `admin@chess.dev` | `ChessAdmin2024!` | All four classic games |

### 4. Open the app

Open **http://localhost:8001** in your browser.

Log in with any seed credential above, or register a new account.

---

## Using the Web Interface

### Uploading a Game

1. Click **Upload Game** in the dashboard.  
2. Paste a PGN string directly into the text area **or** use **Choose File** to upload a `.pgn` file (max 5 MB).  
3. Click **Upload**.  
4. The game appears in your list with status `uploaded`.

### Running Analysis

1. Open any game from your list.  
2. Click **Analyse** — this queues a background Stockfish analysis job.  
3. Status changes: `uploaded` → `analyzing` → `completed` (or `failed`).  
4. Refresh the page or wait for the auto-refetch to see results.

### Reading the Analysis

- **Evaluation bar** on the left shows the centipawn advantage (+white / −black), clamped to ±15 pawns for display.  
- **Move list** on the right colour-codes every move:

| Colour | Label | Meaning |
|---|---|---|
| 🟢 Green | `best` / `excellent` | Optimal or near-optimal play |
| ⚪ White | `good` | Reasonable move, small evaluation change |
| 🟡 Yellow | `inaccuracy` | Eval drop 50–99 cp |
| 🟠 Orange | `mistake` | Eval drop 100–199 cp |
| 🔴 Red | `blunder` | Eval drop ≥ 200 cp |
| 🟣 Purple | `missed_win` | Had ≥ +5 pawns, dropped to < +2 pawns |

- Click any move in the list to jump the board to that position.
- The **Analysis Summary** panel shows per-player blunder/mistake/inaccuracy totals and average centipawn loss.

---

## REST API Reference

Base URL: `http://localhost:8000`

All `/games` endpoints require the header:
```
Authorization: Bearer <jwt>
```

### Auth

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password }` | `{ token, user }` |
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` |
| GET | `/auth/me` | — (auth header) | `{ id, email, created_at }` |

**Password rules**: min 8 characters.

#### Example — login

```bash
curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@chess.dev","password":"ChessAlice2024!"}' | jq .
```

```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": { "id": "uuid...", "email": "alice@chess.dev" }
}
```

---

### Games

#### List games
```
GET /games
```
Returns all games owned by the authenticated user, ordered by `created_at DESC`.

```bash
curl -s http://localhost:8000/games \
  -H "Authorization: Bearer $TOKEN" | jq '.[0]'
```

```json
{
  "id": "uuid...",
  "pgn": "[Event ...] 1.e4 ...",
  "metadata_json": { "event": "London casual game", "white": "Adolf Anderssen", ... },
  "status": "completed",
  "created_at": "...",
  "updated_at": "..."
}
```

---

#### Upload game (PGN text)
```
POST /games
Content-Type: application/json
{ "pgn": "<pgn string>" }
```

#### Upload game (file)
```
POST /games/upload
Content-Type: multipart/form-data
Field: pgn  (file attachment, .pgn extension)
```

Both return:
```json
{ "id": "uuid...", "status": "uploaded", ... }
```

---

#### Get a game
```
GET /games/:id
```

---

#### Delete a game
```
DELETE /games/:id
```
Deletes the game and all associated analysis rows (CASCADE).

---

#### Trigger analysis
```
POST /games/:id/analyze
Body (optional): { "depth": 20 }   // default: 18
```

Rate-limited: **10 analysis jobs per 15 minutes** per IP.

Returns:
```json
{ "message": "Analysis queued", "jobId": "game-uuid..." }
```

---

#### Get analysis results
```
GET /games/:id/analysis
```

Returns an array of move rows, one per ply:

```json
[
  {
    "id": "uuid...",
    "game_id": "uuid...",
    "move_number": 1,
    "move": "e4",
    "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    "eval_before": 20,
    "eval_after": 20,
    "eval_diff": 0,
    "label": "good",
    "best_move": "e2e4",
    "explanation": null
  },
  ...
]
```

---

#### Health check
```
GET /health
```
No auth required. Returns `{ "status": "ok", "env": "production" }`.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `7000` | Internal container port |
| `DATABASE_URL` | *(required)* | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `JWT_SECRET` | *(required)* | HS256 signing secret — **change in production** |
| `JWT_EXPIRES_IN` | `7d` | JWT TTL |
| `STOCKFISH_PATH` | `/usr/games/stockfish` | Absolute path to Stockfish binary |
| `ENGINE_DEPTH` | `18` | Stockfish search depth per position |
| `ENGINE_MAX_CONCURRENT` | `2` | Stockfish process pool size |
| `MAX_FILE_SIZE_MB` | `5` | Multer upload limit |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Global rate limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Requests per window (global) |
| `ANALYSIS_RATE_LIMIT_MAX` | `10` | Analysis jobs per window per IP |
| `CORS_ORIGIN` | `http://localhost:7001` | Allowed CORS origin |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | *(empty — uses nginx proxy)* | Override API base URL for local dev |

---

## Development (without Docker)

### Backend

```bash
cd backend
npm install
cp .env.example .env           # fill DATABASE_URL, REDIS_URL, JWT_SECRET
npm run dev                    # ts-node-dev on :7000
# In a second terminal:
npm run worker                 # analysis worker
```

### Frontend

```bash
cd frontend
npm install
npm run dev                    # Vite dev server on :8001 (proxies to :8000)
```

---

## Common Operations

### Stop all services
```bash
docker compose down
```

### Re-run seed (idempotent — safe to run multiple times)
```bash
docker compose exec backend npx ts-node --skip-project \
  --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' \
  scripts/seed.ts
```

### View backend logs
```bash
docker compose logs -f backend
```

### View worker logs
```bash
docker compose logs -f worker
```

### Connect to the database
```bash
docker compose exec postgres psql -U chess_user -d chess_insight
```

### Flush Redis / job queue
```bash
docker compose exec redis redis-cli FLUSHDB
```

### Rebuild a single image after code changes
```bash
DOCKER_BUILDKIT=1 docker compose up --build backend -d
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `address already in use :8000` | `lsof -n -iTCP:8000 \| grep LISTEN` — kill the process or change port in `docker-compose.yml` |
| Analysis stuck at `analyzing` | Check worker logs: `docker compose logs worker`. Redis must be reachable. |
| `Invalid PGN` error | Validate your PGN at [lichess.org/paste](https://lichess.org/paste) |
| Frontend shows blank page | Check browser console; nginx must proxy successfully to `http://backend:7000` |
| Slow first build | The BuildKit npm cache is cold on first run. Subsequent builds reuse it. |
