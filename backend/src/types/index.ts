// Domain Types for Chess Insight Engine

export interface User {
  id: string;
  email: string;
  password_hash: string;
  rating: number;
  created_at: Date;
}

export type GameStatus = 'uploaded' | 'analyzing' | 'completed' | 'failed';

export type MoveLabel =
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'missed_win';

export interface GameMetadata {
  event?: string;
  site?: string;
  date?: string;
  round?: string;
  white?: string;
  black?: string;
  result?: string;
  whiteElo?: string;
  blackElo?: string;
  timeControl?: string;
  eco?: string;
}

export interface Game {
  id: string;
  user_id: string;
  pgn: string;
  metadata_json: GameMetadata;
  status: GameStatus;
  progress_current: number;
  progress_total: number;
  created_at: Date;
  updated_at: Date;
}

export interface AnalysisRow {
  id: string;
  game_id: string;
  move_number: number;
  move: string;
  fen: string;
  eval_before: number | null;
  eval_after: number | null;
  eval_diff: number | null;
  label: MoveLabel;
  best_move: string | null;
  explanation: string | null;
  created_at: Date;
}

// API Request / Response types
export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string };
}

export interface CreateGameRequest {
  pgn: string;
}

export interface AnalysisJobData {
  gameId: string;
  userId: string;
  depth?: number;
}

// Engine types
export interface EngineEvaluationResult {
  score: number;       // centipawns (white perspective, clamped from mate)
  mate: number | null; // moves to mate if found
  bestMove: string;
  depth: number;
}

export interface ParsedMove {
  moveNumber: number;
  move: string;        // SAN notation
  fen: string;         // FEN after this move
  fenBefore: string;   // FEN before this move
}

// JWT Payload
export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Express augmentation
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ─── Multiplayer Types ────────────────────────────────────────────────────────

export type LiveGameStatus = 'waiting' | 'active' | 'completed' | 'abandoned';
export type TimeControl = 'bullet' | 'blitz' | 'rapid';
export type GameWinner = 'white' | 'black' | 'draw';
export type GameTermination = 'normal' | 'resignation' | 'timeout' | 'draw_agreement' | 'abandoned';

export const TIME_CONTROL_MS: Record<TimeControl, number> = {
  bullet: 60_000,
  blitz: 300_000,
  rapid: 600_000,
};

export interface LiveGame {
  id: string;
  white_user_id: string | null;
  black_user_id: string | null;
  fen: string;
  move_history_json: LiveMove[];
  status: LiveGameStatus;
  winner: GameWinner | null;
  termination: GameTermination;
  time_control: TimeControl;
  white_time_ms: number;
  black_time_ms: number;
  last_move_at: Date | null;
  invite_code: string | null;
  analysis_game_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface LiveMove {
  san: string;
  uci: string;
  fen: string;
  timestamp: number; // ms since epoch
}

export interface RatingHistory {
  id: string;
  user_id: string;
  live_game_id: string;
  rating_before: number;
  rating_after: number;
  rating_change: number;
  created_at: Date;
}

// Socket event payloads
export interface JoinQueuePayload {
  timeControl: TimeControl;
}

export interface CreatePrivateGamePayload {
  timeControl: TimeControl;
}

export interface JoinPrivateGamePayload {
  inviteCode: string;
}

export interface MakeMovePayload {
  gameId: string;
  uci: string; // e.g. "e2e4"
}

export interface ResignPayload {
  gameId: string;
}

export interface OfferDrawPayload {
  gameId: string;
}

export interface AcceptDrawPayload {
  gameId: string;
}

// Socket event responses
export interface GameStartEvent {
  game: LiveGameView;
  color: 'white' | 'black';
}

export interface MoveMadeEvent {
  gameId: string;
  move: LiveMove;
  fen: string;
  white_time_ms: number;
  black_time_ms: number;
  turn: 'w' | 'b';
}

export interface ClockUpdateEvent {
  gameId: string;
  white_time_ms: number;
  black_time_ms: number;
}

export interface GameOverEvent {
  gameId: string;
  winner: GameWinner | null;
  termination: GameTermination;
  white_rating_change?: number;
  black_rating_change?: number;
  analysis_game_id?: string;
}

export interface DrawOfferedEvent {
  gameId: string;
  by: 'white' | 'black';
}

export interface LiveGameView {
  id: string;
  white_user_id: string | null;
  black_user_id: string | null;
  white_email?: string;
  black_email?: string;
  white_rating?: number;
  black_rating?: number;
  fen: string;
  move_history_json: LiveMove[];
  status: LiveGameStatus;
  winner: GameWinner | null;
  termination: GameTermination;
  time_control: TimeControl;
  white_time_ms: number;
  black_time_ms: number;
  invite_code: string | null;
  analysis_game_id: string | null;
}

// ─── Team Mode Types ──────────────────────────────────────────────────────────

export type TeamRole = 'captain' | 'coach' | 'player';

export interface Team {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  captain_id: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  created_at: Date;
  updated_at: Date;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: Date;
  // joined from users table
  email?: string;
  rating?: number;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  token: string;
  created_by: string;
  expires_at: Date;
  max_uses: number | null;
  use_count: number;
  created_at: Date;
}

// ─── Consultation Game Types ──────────────────────────────────────────────────

export type ConsultationSide = 'white' | 'black';
export type ConsultationStatus = 'waiting' | 'active' | 'completed' | 'abandoned';

export interface ConsultationGame {
  id: string;
  white_player1_id: string | null;
  white_player2_id: string | null;
  black_player1_id: string | null;
  black_player2_id: string | null;
  white_team_id: string | null;
  black_team_id: string | null;
  white_executor_id: string | null;
  black_executor_id: string | null;
  fen: string;
  move_history_json: LiveMove[];
  status: ConsultationStatus;
  winner: GameWinner | null;
  termination: GameTermination;
  time_control: TimeControl;
  white_time_ms: number;
  black_time_ms: number;
  last_move_at: Date | null;
  invite_code: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ConsultationSuggestion {
  id: string;
  game_id: string;
  suggested_by: string;
  uci: string;
  san: string | null;
  votes: number;
  voter_ids: string[];
  move_number: number;
  side: ConsultationSide;
  executed: boolean;
  created_at: Date;
  // joined
  suggester_email?: string;
}

// Socket payloads for consultation
export interface SuggestMovePayload { gameId: string; uci: string }
export interface VoteMovePayload    { gameId: string; suggestionId: string }
export interface ExecuteMovePayload { gameId: string; suggestionId: string }
export interface ConsultationChatPayload { gameId: string; message: string; side: ConsultationSide }

// ─── Tournament Types ─────────────────────────────────────────────────────────

export type TournamentFormat = 'swiss' | 'round_robin' | 'knockout';
export type TournamentStatus = 'registration' | 'active' | 'completed' | 'cancelled';
export type MatchStatus = 'pending' | 'active' | 'completed';

export interface Tournament {
  id: string;
  name: string;
  description: string | null;
  organizer_id: string;
  league_id: string | null;
  format: TournamentFormat;
  team_size: number;
  time_control: TimeControl;
  status: TournamentStatus;
  max_teams: number | null;
  rounds_total: number;
  rounds_done: number;
  start_date: Date | null;
  end_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface TournamentTeamEntry {
  tournament_id: string;
  team_id: string;
  seed: number | null;
  match_points: number;
  board_points: number;
  registered_at: Date;
  // joined
  team_name?: string;
  team_rating?: number;
}

export interface TournamentRound {
  id: string;
  tournament_id: string;
  round_number: number;
  status: 'pending' | 'active' | 'completed';
  created_at: Date;
}

export interface TournamentMatch {
  id: string;
  round_id: string;
  tournament_id: string;
  team_a_id: string;
  team_b_id: string;
  team_a_points: number;
  team_b_points: number;
  status: MatchStatus;
  created_at: Date;
  updated_at: Date;
  // joined
  team_a_name?: string;
  team_b_name?: string;
}

export interface TournamentBoard {
  id: string;
  match_id: string;
  board_number: number;
  white_user_id: string | null;
  black_user_id: string | null;
  live_game_id: string | null;
  result: 'white' | 'black' | 'draw' | 'pending' | null;
  created_at: Date;
}

// ─── League Types ─────────────────────────────────────────────────────────────

export type LeagueVisibility = 'public' | 'private';
export type LeagueStatus = 'active' | 'completed' | 'archived';

export interface League {
  id: string;
  name: string;
  description: string | null;
  organizer_id: string;
  visibility: LeagueVisibility;
  invite_code: string | null;
  season: number;
  start_date: Date | null;
  end_date: Date | null;
  status: LeagueStatus;
  created_at: Date;
  updated_at: Date;
}

export interface LeagueTeamEntry {
  league_id: string;
  team_id: string;
  approved: boolean;
  joined_at: Date;
  // joined
  team_name?: string;
  team_rating?: number;
}

export interface LeagueAnnouncement {
  id: string;
  league_id: string;
  author_id: string;
  body: string;
  created_at: Date;
  author_email?: string;
}

// ─── AI Explanation Engine Types ──────────────────────────────────────────────

/** Rating tier buckets drive explanation verbosity. */
export type RatingTier = 'beginner' | 'intermediate' | 'advanced';

export function getRatingTier(rating: number): RatingTier {
  if (rating < 1000) return 'beginner';
  if (rating <= 1600) return 'intermediate';
  return 'advanced';
}

/** Structured position signals extracted from Stockfish output + chess.js. */
export interface PositionFeatures {
  move: string;
  fen: string;
  evaluation_before: number;
  evaluation_after: number;
  evaluation_drop: number;
  material_balance: number;
  king_safety_status: 'safe' | 'slightly_exposed' | 'exposed' | 'critical';
  center_control_status: 'white_dominant' | 'black_dominant' | 'neutral' | 'contested';
  hanging_pieces: boolean;
  tactical_threat_allowed: string | null;
  better_alternative: string;
  principal_variation: string[];
}

/** DB row for position_features */
export interface PositionFeaturesRow extends PositionFeatures {
  id: string;
  position_hash: string;
  game_id: string;
  move_number: number;
  label: MoveLabel;
  created_at: Date;
}

/** DB row for ai_explanations */
export interface AiExplanationRow {
  id: string;
  game_id: string;
  analysis_id: string | null;
  position_hash: string;
  rating_tier: RatingTier;
  explanation: string;
  prompt_tokens: number;
  completion_tokens: number;
  model_used: string;
  created_at: Date;
}

/** DB row for ai_game_summaries */
export interface AiGameSummaryRow {
  id: string;
  game_id: string;
  top_weaknesses: string[];
  training_focus: string;
  tactical_error_count: number;
  positional_error_count: number;
  summary_text: string;
  prompt_tokens: number;
  completion_tokens: number;
  model_used: string;
  created_at: Date;
  updated_at: Date;
}

/** API response shape for single-move explanation */
export interface ExplainMoveResponse {
  explanation: string;
  features: PositionFeatures;
  cached: boolean;
  rating_tier: RatingTier;
  model_used: string;
}

/** API response shape for game AI summary */
export interface GameSummaryResponse {
  summary_text: string;
  top_weaknesses: string[];
  training_focus: string;
  tactical_error_count: number;
  positional_error_count: number;
  cached: boolean;
  model_used: string;
}

/** Mistake theme categories for pattern tracking */
export type MistakeTheme =
  | 'king_safety'
  | 'hanging_pieces'
  | 'endgame'
  | 'opening'
  | 'tactics'
  | 'positional';

export interface UserMistakePattern {
  user_id: string;
  theme: MistakeTheme;
  occurrences: number;
  last_seen_at: Date;
}
