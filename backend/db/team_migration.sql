-- ─── Team Mode Migration ──────────────────────────────────────────────────────
-- Adds: teams, team_members, team_invites,
--       consultation_games, consultation_suggestions,
--       tournaments, tournament_teams, tournament_rounds, tournament_boards,
--       leagues, league_teams, league_announcements

-- ─── Teams ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teams (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(80) UNIQUE NOT NULL,
  logo_url    TEXT,
  description TEXT,
  captain_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rating      INTEGER NOT NULL DEFAULT 1200,
  wins        INTEGER NOT NULL DEFAULT 0,
  losses      INTEGER NOT NULL DEFAULT 0,
  draws       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id   UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      VARCHAR(20) NOT NULL DEFAULT 'player'
              CHECK (role IN ('captain', 'coach', 'player')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

-- Invite tokens for team recruitment
CREATE TABLE IF NOT EXISTS team_invites (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  token      VARCHAR(32) UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  max_uses   INTEGER,
  use_count  INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_team   ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user   ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_token  ON team_invites(token);
CREATE INDEX IF NOT EXISTS idx_team_invites_team   ON team_invites(team_id);

DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 2v2 Consultation Games ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consultation_games (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Each side is a pair of users from the same team (nullable for ad-hoc pairs)
  white_player1_id UUID REFERENCES users(id) ON DELETE SET NULL,
  white_player2_id UUID REFERENCES users(id) ON DELETE SET NULL,
  black_player1_id UUID REFERENCES users(id) ON DELETE SET NULL,
  black_player2_id UUID REFERENCES users(id) ON DELETE SET NULL,
  white_team_id    UUID REFERENCES teams(id) ON DELETE SET NULL,
  black_team_id    UUID REFERENCES teams(id) ON DELETE SET NULL,
  -- Which player from each side is the designated move-submitter
  white_executor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  black_executor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  fen              TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  move_history_json JSONB NOT NULL DEFAULT '[]',
  status           VARCHAR(20) NOT NULL DEFAULT 'waiting'
                     CHECK (status IN ('waiting', 'active', 'completed', 'abandoned')),
  winner           VARCHAR(10) CHECK (winner IN ('white', 'black', 'draw')),
  termination      VARCHAR(30) DEFAULT 'normal'
                     CHECK (termination IN ('normal', 'resignation', 'timeout', 'draw_agreement', 'abandoned')),
  time_control     VARCHAR(20) NOT NULL DEFAULT 'rapid',
  white_time_ms    INTEGER NOT NULL DEFAULT 600000,
  black_time_ms    INTEGER NOT NULL DEFAULT 600000,
  last_move_at     TIMESTAMPTZ,
  invite_code      VARCHAR(20) UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Move suggestions / votes per turn in a consultation game
CREATE TABLE IF NOT EXISTS consultation_suggestions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id         UUID NOT NULL REFERENCES consultation_games(id) ON DELETE CASCADE,
  suggested_by    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  uci             VARCHAR(10) NOT NULL,
  san             VARCHAR(10),
  votes           INTEGER NOT NULL DEFAULT 1,
  -- JSONB array of user_ids that voted
  voter_ids       JSONB NOT NULL DEFAULT '[]',
  move_number     INTEGER NOT NULL,
  side            VARCHAR(5) NOT NULL CHECK (side IN ('white', 'black')),
  executed        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultation_games_status   ON consultation_games(status);
CREATE INDEX IF NOT EXISTS idx_consultation_games_invite   ON consultation_games(invite_code);
CREATE INDEX IF NOT EXISTS idx_consultation_suggestions_game ON consultation_suggestions(game_id);

DROP TRIGGER IF EXISTS update_consultation_games_updated_at ON consultation_games;
CREATE TRIGGER update_consultation_games_updated_at
  BEFORE UPDATE ON consultation_games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Tournaments ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tournaments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(100) NOT NULL,
  description  TEXT,
  organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  league_id    UUID,                              -- optional league association (FK added later)
  format       VARCHAR(30) NOT NULL DEFAULT 'swiss'
                 CHECK (format IN ('swiss', 'round_robin', 'knockout')),
  team_size    INTEGER NOT NULL DEFAULT 4,       -- boards per match
  time_control VARCHAR(20) NOT NULL DEFAULT 'rapid',
  status       VARCHAR(20) NOT NULL DEFAULT 'registration'
                 CHECK (status IN ('registration', 'active', 'completed', 'cancelled')),
  max_teams    INTEGER,
  rounds_total INTEGER NOT NULL DEFAULT 5,
  rounds_done  INTEGER NOT NULL DEFAULT 0,
  start_date   TIMESTAMPTZ,
  end_date     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_teams (
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  seed          INTEGER,
  match_points  NUMERIC(6,1) NOT NULL DEFAULT 0,  -- match-level points (2=match win,1=draw,0=loss)
  board_points  NUMERIC(6,1) NOT NULL DEFAULT 0,  -- individual board points aggregated
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tournament_id, team_id)
);

-- A round groups pairings for one round of play
CREATE TABLE IF NOT EXISTS tournament_rounds (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number  INTEGER NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'active', 'completed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, round_number)
);

-- A match is one team vs another within a round; contains N boards
CREATE TABLE IF NOT EXISTS tournament_matches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  round_id        UUID NOT NULL REFERENCES tournament_rounds(id) ON DELETE CASCADE,
  tournament_id   UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_a_id       UUID NOT NULL REFERENCES teams(id),
  team_b_id       UUID NOT NULL REFERENCES teams(id),
  team_a_points   NUMERIC(5,1) NOT NULL DEFAULT 0,
  team_b_points   NUMERIC(5,1) NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'completed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One live_game per board slot in a match
CREATE TABLE IF NOT EXISTS tournament_boards (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id      UUID NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  board_number  INTEGER NOT NULL,
  white_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  black_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  live_game_id  UUID REFERENCES live_games(id) ON DELETE SET NULL,
  result        VARCHAR(10) CHECK (result IN ('white', 'black', 'draw', 'pending')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, board_number)
);

CREATE INDEX IF NOT EXISTS idx_tournaments_status      ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_organizer   ON tournaments(organizer_id);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_team   ON tournament_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_round ON tournament_matches(round_id);
CREATE INDEX IF NOT EXISTS idx_tournament_boards_match ON tournament_boards(match_id);

DROP TRIGGER IF EXISTS update_tournaments_updated_at ON tournaments;
CREATE TRIGGER update_tournaments_updated_at
  BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tournament_matches_updated_at ON tournament_matches;
CREATE TRIGGER update_tournament_matches_updated_at
  BEFORE UPDATE ON tournament_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Leagues ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leagues (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(100) NOT NULL,
  description  TEXT,
  organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  visibility   VARCHAR(10) NOT NULL DEFAULT 'private'
                 CHECK (visibility IN ('public', 'private')),
  invite_code  VARCHAR(20) UNIQUE,
  season       INTEGER NOT NULL DEFAULT 1,
  start_date   TIMESTAMPTZ,
  end_date     TIMESTAMPTZ,
  status       VARCHAR(20) NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'completed', 'archived')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS league_teams (
  league_id    UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  team_id      UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  approved     BOOLEAN NOT NULL DEFAULT false,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (league_id, team_id)
);

CREATE TABLE IF NOT EXISTS league_announcements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id   UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link tournaments to leagues
ALTER TABLE tournaments
  ADD CONSTRAINT fk_tournaments_league
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leagues_status       ON leagues(status);
CREATE INDEX IF NOT EXISTS idx_leagues_invite       ON leagues(invite_code);
CREATE INDEX IF NOT EXISTS idx_league_teams_team    ON league_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_league_announcements ON league_announcements(league_id);

DROP TRIGGER IF EXISTS update_leagues_updated_at ON leagues;
CREATE TRIGGER update_leagues_updated_at
  BEFORE UPDATE ON leagues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
