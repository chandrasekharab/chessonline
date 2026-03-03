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

  engineFirstMove: (difficulty: number) =>
    api.post<TutorialFirstMoveResponse>('/tutorial/engine-first-move', { difficulty }),
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
