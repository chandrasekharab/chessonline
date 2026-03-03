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
