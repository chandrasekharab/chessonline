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

### Switching Themes

Click the theme icon in the top-right of the **Navbar** to cycle through:

| Mode | Behaviour |
|---|---|
| **Dark** *(default)* | Dark background, light text |
| **Light** | Light background, dark text |
| **System** | Follows your OS `prefers-color-scheme` setting |

Your choice is saved to `localStorage` and restored on next visit. You can also change the **board colour theme** (square and piece set) from the same menu.

---

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
- **Hover preview**: hovering over any move in the list temporarily shows that position on the board (without committing to it). Mouse-leave restores your current position.
- **Board arrows**: when you navigate to a move, two arrow layers appear:
  - A **solid coloured arrow** (matching the move label colour) shows the move that was played.
  - A **dashed cyan arrow** appears for blunders, mistakes, inaccuracies, and missed wins — it shows Stockfish's recommended best response for the opponent, i.e. the engine line from `best_move` in the following ply.
- The **Analysis Summary** panel shows per-player blunder/mistake/inaccuracy totals and average centipawn loss.
- The **AI Coach** panel (if `AI_EXPLANATIONS_ENABLED=true`) shows an LLM-generated explanation for each bad move, personalised by rating tier. Click **Ask AI** on any move to request an explanation on demand.

---

### Live Multiplayer

1. Click **Play Live** in the Navbar or Dashboard.  
2. Select a **time control** (e.g. 5+0 Blitz, 10+0 Rapid) and click **Find Match**.  
3. The lobby displays your ELO rating while the server searches for an opponent with a similar rating.  
4. Once matched, the **Live Board** appears. Make moves by clicking or dragging pieces.  
5. Player clocks count down independently; flagging (running out of time) is a loss.  
6. A **Game Over** modal shows the result, final position, and updated ELO immediately after the game ends.  
7. Completed live games are saved to your history and can be viewed under **Live Games** → individual game page.

---

### Puzzle Training

1. Click **Puzzles** in the Navbar.  
2. The server selects the next unsolved puzzle from the database, starting at a rating appropriate for your level.  
3. You are shown a position — it is your turn to move. Find the winning combination!  
4. Click or drag a piece to make a move:
   - **Correct move**: the board plays the opponent's response and prompts for the next move in the sequence.
   - **Wrong move**: the position resets to the start and you can try again.
5. Click **Hint** to see the engine's top suggestion (this marks the puzzle as hinted in your stats).  
6. Click **Resign** to skip and see the solution.  
7. Your **stats** (attempted, solved, streak) are visible at the top of the page.  
8. After solving a puzzle, the **AI Explainer** panel can show an LLM explanation of the key tactical idea.

---

### Tutorial

1. Click **Tutorial** in the Navbar.  
2. Choose a lesson from the list (e.g. *Italian Game*, *King and Pawn Endgame*).  
3. The board is set up to the lesson's starting position via `PositionSetupBoard`.  
4. Follow the on-screen instructions and make the recommended moves:
   - The server validates your move against the expected principal variation.
   - Stockfish automatically plays the engine's response.  
5. Click **Hint** at any time to see the best move for the current position.

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

### Live Games

All `/live` endpoints require `Authorization: Bearer <jwt>`.

| Method | Path | Description |
|---|---|---|
| GET | `/live/history` | All completed live games for the authenticated user |
| GET | `/live/:id` | Single live game details + PGN |
| GET | `/live/active/mine` | Currently active (in-progress) game, if any |

Live game actions (start, move, resign, flag) are performed via **Socket.IO events**, not REST.

---

### Puzzles

All `/puzzles` endpoints require `Authorization: Bearer <jwt>`.

| Method | Path | Body | Description |
|---|---|---|---|
| GET | `/puzzles/next` | — | Next unsolved puzzle for the user |
| GET | `/puzzles/stats` | — | User puzzle statistics (attempted, solved, streak) |
| POST | `/puzzles/:id/move` | `{ move: "e2e4" }` | Submit a move (UCI); returns `{ correct, done, nextMove }` |
| POST | `/puzzles/:id/resign` | — | Skip puzzle and reveal solution |

---

### Tutorial

All `/tutorial` endpoints require `Authorization: Bearer <jwt>`.

| Method | Path | Body | Description |
|---|---|---|---|
| POST | `/tutorial/move` | `{ fen, move, lessonId }` | Validate player move; returns engine response move |
| POST | `/tutorial/hint` | `{ fen }` | Get Stockfish's best move suggestion |
| POST | `/tutorial/engine-first-move` | `{ fen }` | Get engine's opening move (for black-side lessons) |

---

### AI Explanations

All `/explanations` endpoints require `Authorization: Bearer <jwt>`.  
These endpoints are only functional when `AI_EXPLANATIONS_ENABLED=true` on the backend.

| Method | Path | Description |
|---|---|---|
| POST | `/explanations/games/:gameId/moves/:moveNumber` | Request LLM explanation for a specific move (cached after first call) |
| GET | `/explanations/games/:gameId/summary` | Get or generate the AI-coaching summary for a completed game |
| GET | `/explanations/games/:gameId/all` | All cached AI explanations for a game |
| GET | `/explanations/me/patterns` | Aggregated mistake patterns / weaknesses for the user |
| GET | `/explanations/me/token-usage` | LLM token consumption statistics for cost monitoring |

**Example — request a move explanation:**
```bash
curl -s -X POST http://localhost:8000/explanations/games/$GAME_ID/moves/15 \
  -H "Authorization: Bearer $TOKEN" | jq .explanation
```

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
| `AI_EXPLANATIONS_ENABLED` | `false` | Master toggle for LLM explanation pipeline |
| `LLM_PROVIDER` | `openai` | `openai` \| `anthropic` \| `ollama` \| `custom` |
| `LLM_MODEL` | `gpt-4o-mini` | LLM model name |
| `LLM_BASE_URL` | *(empty)* | Custom OpenAI-compatible endpoint |
| `OPENAI_API_KEY` | *(empty)* | Required for OpenAI provider |
| `ANTHROPIC_API_KEY` | *(empty)* | Required for Anthropic provider |
| `EXPLANATION_MIN_DROP_CP` | `100` | Minimum eval drop (cp) to generate explanation |
| `LLM_MAX_TOKENS` | `300` | Max tokens per move explanation |

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
| Live game not connecting | Check that WebSocket upgrade is not blocked by a proxy; Socket.IO falls back to long-polling if WebSocket fails. |
| AI explanations not appearing | Ensure `AI_EXPLANATIONS_ENABLED=true` and the correct `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` is set in `backend/.env`. |
| Puzzle page shows no puzzles | Run the puzzle seeder: `docker compose exec backend npx ts-node --skip-project --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' scripts/seed_puzzles.ts` |
