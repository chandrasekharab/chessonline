CREATE TABLE IF NOT EXISTS puzzles (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  fen         TEXT    NOT NULL,
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
