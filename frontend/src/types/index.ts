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

// ─── AI Explanation Engine Types ─────────────────────────────────────────────

export type RatingTier = 'beginner' | 'intermediate' | 'advanced';

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

export interface ExplainMoveResponse {
  explanation: string;
  features: PositionFeatures;
  cached: boolean;
  rating_tier: RatingTier;
  model_used: string;
}

export interface GameSummaryResponse {
  summary_text: string;
  top_weaknesses: string[];
  training_focus: string;
  tactical_error_count: number;
  positional_error_count: number;
  cached: boolean;
  model_used: string;
}

export interface MistakePattern {
  user_id: string;
  theme: string;
  occurrences: number;
  last_seen_at: string;
}

// ─── AI Coach Chat ──────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;          // local uuid
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;   // Date.now()
  pending?: boolean;   // optimistic while waiting
}

export interface CoachChatContext {
  players?: string;
  event?: string;
  currentMove?: string;
  moveNumber?: number;
  label?: string;
  eval_before?: number;
  eval_after?: number;
  best_move?: string;
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
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: string;
  email?: string;
  rating?: number;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  token: string;
  created_by: string;
  expires_at: string;
  max_uses: number | null;
  use_count: number;
  created_at: string;
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
  white_team_id:    string | null;
  black_team_id:    string | null;
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
  invite_code: string | null;
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
  created_at: string;
  suggester_email?: string;
}

// Socket events
export interface ConsultationMoveMadeEvent {
  gameId: string;
  move: LiveMove;
  fen: string;
  white_time_ms: number;
  black_time_ms: number;
  turn: 'w' | 'b';
}

export interface ConsultationSuggestionsEvent {
  gameId: string;
  moveNumber: number;
  side: ConsultationSide;
  suggestions: ConsultationSuggestion[];
}

export interface ConsultationChatMsgEvent {
  gameId: string;
  side: ConsultationSide;
  senderId: string;
  message: string;
  timestamp: number;
}

export interface ConsultationGameOverEvent {
  gameId: string;
  winner: GameWinner | null;
  termination: GameTermination;
}

// ─── Tournament Types ─────────────────────────────────────────────────────────

export type TournamentFormat = 'swiss' | 'round_robin' | 'knockout';
export type TournamentStatus = 'registration' | 'active' | 'completed' | 'cancelled';

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
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface TournamentTeamEntry {
  tournament_id: string;
  team_id: string;
  seed: number | null;
  match_points: number;
  board_points: number;
  registered_at: string;
  team_name?: string;
  team_rating?: number;
}

export interface TournamentRound {
  id: string;
  tournament_id: string;
  round_number: number;
  status: 'pending' | 'active' | 'completed';
  created_at: string;
}

export interface TournamentMatch {
  id: string;
  round_id: string;
  tournament_id: string;
  team_a_id: string;
  team_b_id: string;
  team_a_points: number;
  team_b_points: number;
  status: 'pending' | 'active' | 'completed';
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
  start_date: string | null;
  end_date: string | null;
  status: LeagueStatus;
  created_at: string;
}

export interface LeagueTeamEntry {
  league_id: string;
  team_id: string;
  approved: boolean;
  joined_at: string;
  team_name?: string;
  team_rating?: number;
}

export interface LeagueAnnouncement {
  id: string;
  league_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_email?: string;
}

export interface CoachChatResponse {
  reply: string;
  model_used: string;
}
