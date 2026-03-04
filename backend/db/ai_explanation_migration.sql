-- ─── AI Explanation Engine Migration ─────────────────────────────────────────
-- Run after schema.sql to add AI-powered explanation tables.

-- Position feature cache: structured signals extracted from chess positions.
-- Keyed by a SHA-256 hash of (fen + best_move) to enable cache hits.
CREATE TABLE IF NOT EXISTS position_features (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  position_hash   CHAR(64) UNIQUE NOT NULL,   -- SHA-256(fen + '|' + best_move)
  game_id         UUID    NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  move_number     INTEGER NOT NULL,
  move            VARCHAR(20) NOT NULL,
  fen             TEXT    NOT NULL,
  label           VARCHAR(30) NOT NULL,
  eval_before     NUMERIC(8,2),
  eval_after      NUMERIC(8,2),
  eval_drop       NUMERIC(8,2),
  material_balance NUMERIC(6,2) NOT NULL DEFAULT 0,
  king_safety_status   VARCHAR(30) NOT NULL DEFAULT 'safe',     -- safe | slightly_exposed | exposed | critical
  center_control_status VARCHAR(30) NOT NULL DEFAULT 'neutral', -- white_dominant | black_dominant | neutral | contested
  hanging_pieces  BOOLEAN NOT NULL DEFAULT FALSE,
  tactical_threat_allowed TEXT,   -- null or short description, e.g. 'back-rank mate'
  better_alternative VARCHAR(20), -- SAN of best alternative
  principal_variation  TEXT[],    -- array of SAN moves
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI explanations: cached per position-hash + rating tier
CREATE TABLE IF NOT EXISTS ai_explanations (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id         UUID    NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  analysis_id     UUID    REFERENCES analysis(id) ON DELETE CASCADE,
  position_hash   CHAR(64) NOT NULL,
  rating_tier     VARCHAR(20) NOT NULL DEFAULT 'intermediate', -- beginner | intermediate | advanced
  explanation     TEXT    NOT NULL,
  prompt_tokens   INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  model_used      VARCHAR(80) NOT NULL DEFAULT 'gpt-4o-mini',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (position_hash, rating_tier)                          -- cache key
);

-- AI game summaries
CREATE TABLE IF NOT EXISTS ai_game_summaries (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id         UUID    NOT NULL UNIQUE REFERENCES games(id) ON DELETE CASCADE,
  top_weaknesses  TEXT[]  NOT NULL DEFAULT '{}',
  training_focus  TEXT    NOT NULL DEFAULT '',
  tactical_error_count  INTEGER NOT NULL DEFAULT 0,
  positional_error_count INTEGER NOT NULL DEFAULT 0,
  summary_text    TEXT    NOT NULL,
  prompt_tokens   INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  model_used      VARCHAR(80) NOT NULL DEFAULT 'gpt-4o-mini',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User mistake patterns: aggregated over time for personalisation
CREATE TABLE IF NOT EXISTS user_mistake_patterns (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme           VARCHAR(40) NOT NULL,  -- king_safety | hanging_pieces | endgame | opening | tactics | positional
  occurrences     INTEGER NOT NULL DEFAULT 1,
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, theme)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_position_features_hash  ON position_features(position_hash);
CREATE INDEX IF NOT EXISTS idx_position_features_game  ON position_features(game_id);
CREATE INDEX IF NOT EXISTS idx_ai_explanations_hash    ON ai_explanations(position_hash);
CREATE INDEX IF NOT EXISTS idx_ai_explanations_game    ON ai_explanations(game_id);
CREATE INDEX IF NOT EXISTS idx_ai_game_summaries_game  ON ai_game_summaries(game_id);
CREATE INDEX IF NOT EXISTS idx_user_mistake_patterns   ON user_mistake_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mistake_patterns_theme ON user_mistake_patterns(user_id, theme);

-- ─── Explanation token usage log (cost tracking) ──────────────────────────────
CREATE TABLE IF NOT EXISTS llm_token_log (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID    REFERENCES users(id) ON DELETE SET NULL,
  game_id         UUID    REFERENCES games(id) ON DELETE SET NULL,
  operation       VARCHAR(40) NOT NULL,   -- explain_move | game_summary | chat
  model           VARCHAR(80) NOT NULL,
  prompt_tokens   INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_token_log_user ON llm_token_log(user_id);
CREATE INDEX IF NOT EXISTS idx_llm_token_log_game ON llm_token_log(game_id);

-- Trigger for ai_game_summaries updated_at
DROP TRIGGER IF EXISTS update_ai_game_summaries_updated_at ON ai_game_summaries;
CREATE TRIGGER update_ai_game_summaries_updated_at
  BEFORE UPDATE ON ai_game_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
