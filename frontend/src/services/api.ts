import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import type {
  Game,
  AnalysisResponse,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

// ─── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  register: (email: string, password: string) =>
    api.post<{ token: string; user: { id: string; email: string } }>(
      '/auth/register',
      { email, password }
    ),

  login: (email: string, password: string) =>
    api.post<{ token: string; user: { id: string; email: string } }>(
      '/auth/login',
      { email, password }
    ),
};

// ─── Games ─────────────────────────────────────────────────────────────────

export const gamesApi = {
  list: (limit = 20, offset = 0) =>
    api.get<{ games: Game[]; total: number }>('/games', { params: { limit, offset } }),

  get: (id: string) => api.get<{ game: Game }>(`/games/${id}`),

  create: (pgn: string) => api.post<{ game: Game }>('/games', { pgn }),

  upload: (file: File) => {
    const formData = new FormData();
    formData.append('pgn', file);
    return api.post<{ game: Game }>('/games/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  delete: (id: string) => api.delete(`/games/${id}`),

  analyze: (id: string, depth?: number) =>
    api.post<{ message: string }>(`/games/${id}/analyze`, { depth }),

  getAnalysis: (id: string) => api.get<AnalysisResponse>(`/games/${id}/analysis`),
};

// ─── Tutorial ──────────────────────────────────────────────────────────────

export interface TutorialMoveDetail {
  uci: string;
  san: string;
  label: string;
  eval_before: number;
  eval_after: number;
  explanation: string;
}

export interface TutorialMoveResponse {
  player_move: TutorialMoveDetail;
  engine_move: TutorialMoveDetail | null;
  fen_after_player: string;
  fen_after_engine: string;
  game_over: { winner: 'white' | 'black' | 'draw'; reason: string } | null;
}

export interface TutorialHintResponse {
  best_move_uci: string;
  best_move_san: string;
  explanation: string;
  eval_cp: number;
}

export interface TutorialFirstMoveResponse {
  uci: string;
  san: string;
  explanation: string;
  fen_after: string;
}

export const tutorialApi = {
  move: (fen: string, move: string, playerColor: 'white' | 'black', difficulty: number) =>
    api.post<TutorialMoveResponse>('/tutorial/move', { fen, move, playerColor, difficulty }),

  hint: (fen: string, playerColor: 'white' | 'black', difficulty: number) =>
    api.post<TutorialHintResponse>('/tutorial/hint', { fen, playerColor, difficulty }),

  engineFirstMove: (difficulty: number, fen?: string) =>
    api.post<TutorialFirstMoveResponse>('/tutorial/engine-first-move', { difficulty, ...(fen ? { fen } : {}) }),
};

// ─── Puzzles ───────────────────────────────────────────────────────────────

export interface PuzzlePublic {
  id: string;
  fen: string;
  theme: string;
  difficulty: number;
  title: string;
  description: string;
  total_player_moves: number;
}

export interface PuzzleMoveResult {
  correct: boolean;
  solved: boolean;
  engine_reply_uci?: string;
  engine_reply_fen?: string;
  solution_uci?: string;
  feedback: string;
}

export interface PuzzleStats {
  solved_count: number;
  attempted_count: number;
  accuracy: number;
}

export const puzzleApi = {
  next: (theme?: string, difficulty?: number) =>
    api.get<{ puzzle: PuzzlePublic }>('/puzzles/next', {
      params: { ...(theme && { theme }), ...(difficulty && { difficulty }) },
    }),

  move: (id: string, moveUci: string, currentFen: string, solutionIndex: number) =>
    api.post<PuzzleMoveResult>(`/puzzles/${id}/move`, { moveUci, currentFen, solutionIndex }),

  resign: (id: string) =>
    api.post<{ solution_uci: string }>(`/puzzles/${id}/resign`),

  stats: () =>
    api.get<PuzzleStats>('/puzzles/stats'),
};

// ─── Teams ─────────────────────────────────────────────────────────────────

import type {
  Team, TeamMember, TeamInvite, TeamRole,
  Tournament, TournamentTeamEntry, TournamentRound, TournamentMatch, TournamentBoard,
  TournamentFormat, TournamentStatus,
  League, LeagueTeamEntry, LeagueAnnouncement, LeagueVisibility,
} from '../types';

export const teamsApi = {
  list: (q?: string, limit = 20, offset = 0) =>
    api.get<{ teams: Team[]; total: number }>('/teams', { params: { q, limit, offset } }),

  myTeams: () =>
    api.get<{ teams: (Team & { role: TeamRole })[] }>('/teams/me'),

  get: (id: string) =>
    api.get<{ team: Team; members: TeamMember[] }>(`/teams/${id}`),

  create: (data: { name: string; description?: string; logo_url?: string }) =>
    api.post<{ team: Team }>('/teams', data),

  update: (id: string, data: { name?: string; description?: string | null; logo_url?: string | null }) =>
    api.patch<{ team: Team }>(`/teams/${id}`, data),

  delete: (id: string) => api.delete(`/teams/${id}`),

  addMember: (teamId: string, userId: string, role: TeamRole = 'player') =>
    api.post<{ message: string }>(`/teams/${teamId}/members`, { user_id: userId, role }),

  removeMember: (teamId: string, userId: string) =>
    api.delete(`/teams/${teamId}/members/${userId}`),

  setMemberRole: (teamId: string, userId: string, role: TeamRole) =>
    api.patch(`/teams/${teamId}/members/${userId}/role`, { role }),

  createInviteLink: (teamId: string, maxUses?: number) =>
    api.post<{ invite: TeamInvite }>(`/teams/${teamId}/invites`, { max_uses: maxUses }),

  getInvites: (teamId: string) =>
    api.get<{ invites: TeamInvite[] }>(`/teams/${teamId}/invites`),

  revokeInvite: (teamId: string, inviteId: string) =>
    api.delete(`/teams/${teamId}/invites/${inviteId}`),

  joinByInvite: (token: string) =>
    api.post<{ team: Team }>(`/teams/join/${token}`),
};

// ─── Tournaments ───────────────────────────────────────────────────────────

export const tournamentsApi = {
  list: (params?: { status?: TournamentStatus; league_id?: string; limit?: number; offset?: number }) =>
    api.get<{ tournaments: Tournament[]; total: number }>('/tournaments', { params }),

  get: (id: string) =>
    api.get<{ tournament: Tournament; standings: TournamentTeamEntry[]; rounds: TournamentRound[] }>(
      `/tournaments/${id}`),

  create: (data: {
    name: string; description?: string; format: TournamentFormat; team_size?: number;
    time_control?: string; max_teams?: number; rounds_total?: number;
    start_date?: string; league_id?: string;
  }) => api.post<{ tournament: Tournament }>('/tournaments', data),

  registerTeam: (tournamentId: string, teamId: string) =>
    api.post<{ entry: TournamentTeamEntry }>(`/tournaments/${tournamentId}/register`, { team_id: teamId }),

  start: (id: string) =>
    api.post<{ round: TournamentRound }>(`/tournaments/${id}/start`),

  getRoundMatches: (roundId: string) =>
    api.get<{ matches: TournamentMatch[] }>(`/tournaments/rounds/${roundId}/matches`),

  getMatch: (matchId: string) =>
    api.get<{ match: TournamentMatch; boards: TournamentBoard[] }>(`/tournaments/matches/${matchId}`),

  submitBoardResult: (matchId: string, boardId: string, result: 'white' | 'black' | 'draw', liveGameId?: string) =>
    api.post(`/tournaments/matches/${matchId}/boards/${boardId}/result`, { result, live_game_id: liveGameId }),
};

// ─── Leagues ───────────────────────────────────────────────────────────────

export const leaguesApi = {
  list: (params?: { visibility?: LeagueVisibility; limit?: number; offset?: number }) =>
    api.get<{ leagues: League[]; total: number }>('/leagues', { params }),

  get: (id: string) =>
    api.get<{ league: League; teams: LeagueTeamEntry[]; announcements: LeagueAnnouncement[]; tournaments: { tournaments: Tournament[] } }>(
      `/leagues/${id}`),

  create: (data: { name: string; description?: string; visibility: LeagueVisibility; season?: number; start_date?: string; end_date?: string }) =>
    api.post<{ league: League }>('/leagues', data),

  update: (id: string, data: Record<string, unknown>) =>
    api.patch<{ league: League }>(`/leagues/${id}`, data),

  getStandings: (id: string) =>
    api.get<{ standings: LeagueTeamEntry[] }>(`/leagues/${id}/standings`),

  joinById: (leagueId: string, teamId: string, inviteCode?: string) =>
    api.post<{ entry: LeagueTeamEntry }>(`/leagues/${leagueId}/join`, { team_id: teamId, invite_code: inviteCode }),

  joinByCode: (code: string, teamId: string) =>
    api.post<{ league: League }>(`/leagues/join/${code}`, { team_id: teamId }),

  approveTeam: (leagueId: string, teamId: string) =>
    api.post(`/leagues/${leagueId}/teams/${teamId}/approve`),

  removeTeam: (leagueId: string, teamId: string) =>
    api.delete(`/leagues/${leagueId}/teams/${teamId}`),

  postAnnouncement: (leagueId: string, body: string) =>
    api.post<{ announcement: LeagueAnnouncement }>(`/leagues/${leagueId}/announcements`, { body }),
};

// Helper: extract error message
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.error ??
      error.response?.data?.message ??
      error.message
    );
  }
  return String(error);
}

// ─── AI Explanations ───────────────────────────────────────────────────
import type { ExplainMoveResponse, GameSummaryResponse, MistakePattern } from '../types';

export const explanationApi = {
  /** Explain a single move (POST triggers LLM if not cached) */
  explainMove: (gameId: string, moveNumber: number) =>
    api.post<ExplainMoveResponse>(`/explanations/games/${gameId}/moves/${moveNumber}`),

  /** Get or generate AI post-game summary */
  getGameSummary: (gameId: string) =>
    api.get<GameSummaryResponse>(`/explanations/games/${gameId}/summary`),

  /** All cached explanations for a game (lightweight, no LLM call) */
  getAllExplanations: (gameId: string) =>
    api.get<{ explanations: (ExplainMoveResponse & { move_number: number; move: string })[] }>(
      `/explanations/games/${gameId}/all`,
    ),

  /** User's accumulated mistake patterns */
  getMistakePatterns: () =>
    api.get<{ patterns: MistakePattern[] }>('/explanations/me/patterns'),

  /** User's LLM token usage stats */
  getTokenUsage: () =>
    api.get<{ total_tokens: number; prompt_tokens: number; completion_tokens: number }>(
      '/explanations/me/token-usage',
    ),

  /** Explain a completed puzzle solution */
  explainPuzzle: (fen: string, solution: string[], tags: string[], rating?: number) =>
    api.post<{ explanation: string; model_used: string }>('/explanations/puzzle/explain', {
      fen, solution, tags, rating,
    }),

  /** Free-form AI coach chat for a game */
  chat: (
    gameId: string,
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    context?: import('../types').CoachChatContext,
  ) =>
    api.post<{ reply: string; model_used: string }>(
      `/explanations/games/${gameId}/chat`,
      { message, history, context },
    ),
};
