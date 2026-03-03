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
  white?: string;
  black?: string;
  result?: string;
  whiteElo?: string;
  blackElo?: string;
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
  created_at: string;
  updated_at: string;
}

export interface AnalysisMove {
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
  created_at: string;
}

export interface AnalysisResponse {
  game: Game;
  moves: AnalysisMove[];
  summary: Record<string, number>;
}

export interface AuthUser {
  id: string;
  email: string;
}

export const LABEL_COLORS: Record<MoveLabel, string> = {
  best: '#22c55e',
  excellent: '#86efac',
  good: '#cbd5e1',
  inaccuracy: '#fbbf24',
  mistake: '#f97316',
  blunder: '#ef4444',
  missed_win: '#a855f7',
};

export const LABEL_DISPLAY: Record<MoveLabel, string> = {
  best: 'Best',
  excellent: 'Excellent',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
  missed_win: 'Missed Win',
};

// ─── Multiplayer / Live Game Types ───────────────────────────────────────────

export type LiveGameStatus = 'waiting' | 'active' | 'completed' | 'abandoned';
export type TimeControl = 'bullet' | 'blitz' | 'rapid';
export type GameWinner = 'white' | 'black' | 'draw';
export type GameTermination = 'normal' | 'resignation' | 'timeout' | 'draw_agreement' | 'abandoned';

export interface LiveMove {
  san: string;
  uci: string;
  fen: string;
  timestamp: number;
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

// Socket payloads sent by client
export interface JoinQueuePayload { timeControl: TimeControl }
export interface CreatePrivateGamePayload { timeControl: TimeControl }
export interface JoinPrivateGamePayload { inviteCode: string }
export interface MakeMovePayload { gameId: string; uci: string }
export interface ResignPayload { gameId: string }
export interface OfferDrawPayload { gameId: string }
export interface AcceptDrawPayload { gameId: string }

// Socket events received from server
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

export const TIME_CONTROL_LABELS: Record<TimeControl, string> = {
  bullet: 'Bullet (1 min)',
  blitz: 'Blitz (5 min)',
  rapid: 'Rapid (10 min)',
};
