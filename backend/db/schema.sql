-- Chess Insight Engine Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 1200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pgn TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'analyzing', 'completed', 'failed')),
  progress_current INTEGER NOT NULL DEFAULT 0,
  progress_total   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Analysis table
CREATE TABLE IF NOT EXISTS analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  move VARCHAR(20) NOT NULL,
  fen TEXT NOT NULL,
  eval_before NUMERIC(8,2),
  eval_after NUMERIC(8,2),
  eval_diff NUMERIC(8,2),
  label VARCHAR(30) NOT NULL DEFAULT 'good'
    CHECK (label IN ('good', 'inaccuracy', 'mistake', 'blunder', 'missed_win', 'best', 'excellent')),
  best_move VARCHAR(20),
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_analysis_game_id ON analysis(game_id);
CREATE INDEX IF NOT EXISTS idx_analysis_game_move ON analysis(game_id, move_number);

-- ─── Multiplayer Live Games ───────────────────────────────────────────────────

-- Live games table
CREATE TABLE IF NOT EXISTS live_games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  white_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  black_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  move_history_json JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'active', 'completed', 'abandoned')),
  winner VARCHAR(10) CHECK (winner IN ('white', 'black', 'draw')),
  termination VARCHAR(30) DEFAULT 'normal'
    CHECK (termination IN ('normal', 'resignation', 'timeout', 'draw_agreement', 'abandoned')),
  time_control VARCHAR(20) NOT NULL DEFAULT 'rapid',
  white_time_ms INTEGER NOT NULL DEFAULT 600000,
  black_time_ms INTEGER NOT NULL DEFAULT 600000,
  last_move_at TIMESTAMPTZ,
  invite_code VARCHAR(20) UNIQUE,
  analysis_game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rating history table
CREATE TABLE IF NOT EXISTS rating_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  live_game_id UUID NOT NULL REFERENCES live_games(id) ON DELETE CASCADE,
  rating_before INTEGER NOT NULL,
  rating_after INTEGER NOT NULL,
  rating_change INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Live game indexes
CREATE INDEX IF NOT EXISTS idx_live_games_white ON live_games(white_user_id);
CREATE INDEX IF NOT EXISTS idx_live_games_black ON live_games(black_user_id);
CREATE INDEX IF NOT EXISTS idx_live_games_status ON live_games(status);
CREATE INDEX IF NOT EXISTS idx_live_games_invite ON live_games(invite_code);
CREATE INDEX IF NOT EXISTS idx_rating_history_user ON rating_history(user_id);


-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_games_updated_at ON games;
CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_live_games_updated_at ON live_games;
CREATE TRIGGER update_live_games_updated_at
  BEFORE UPDATE ON live_games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Puzzles ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS puzzles (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  fen         TEXT    NOT NULL,
  -- Space-separated UCI moves: player engine player engine …
  -- Even indices (0,2,4…) are player moves; odd indices are engine replies.
  solution_uci TEXT   NOT NULL,
  theme       VARCHAR(50)  NOT NULL DEFAULT 'tactics',
  difficulty  INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  title       TEXT    NOT NULL DEFAULT 'Puzzle',
  description TEXT    NOT NULL DEFAULT '',
  rating      INTEGER NOT NULL DEFAULT 1200,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS puzzle_attempts (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID    NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  puzzle_id   UUID    NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  solved      BOOLEAN NOT NULL DEFAULT false,
  moves_played INTEGER NOT NULL DEFAULT 0,
  time_taken_ms INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_puzzle_attempts_user_puzzle ON puzzle_attempts(user_id, puzzle_id);
CREATE INDEX IF NOT EXISTS idx_puzzles_theme      ON puzzles(theme);
CREATE INDEX IF NOT EXISTS idx_puzzles_difficulty ON puzzles(difficulty);
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_user ON puzzle_attempts(user_id);

DROP TRIGGER IF EXISTS update_puzzle_attempts_updated_at ON puzzle_attempts;
CREATE TRIGGER update_puzzle_attempts_updated_at
  BEFORE UPDATE ON puzzle_attempts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
