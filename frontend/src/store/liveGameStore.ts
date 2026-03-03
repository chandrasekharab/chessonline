import { create } from 'zustand';
import {
  LiveGameView,
  LiveMove,
  GameWinner,
  GameTermination,
  TimeControl,
} from '../types';

export interface GameOverInfo {
  winner: GameWinner | null;
  termination: GameTermination;
  white_rating_change?: number;
  black_rating_change?: number;
  analysis_game_id?: string;
}

interface LiveGameState {
  // Current active game
  gameId: string | null;
  game: LiveGameView | null;
  myColor: 'white' | 'black' | null;
  fen: string;
  moves: LiveMove[];
  turn: 'w' | 'b';
  whiteTimeMs: number;
  blackTimeMs: number;

  // Matchmaking state
  isQueued: boolean;
  queueTimeControl: TimeControl | null;

  // Private game lobby
  privateGameId: string | null;
  inviteCode: string | null;
  waitingForOpponent: boolean;

  // Draw
  drawOfferedBy: 'white' | 'black' | null;

  // Game over
  gameOver: GameOverInfo | null;

  // Actions
  setGame: (game: LiveGameView, color: 'white' | 'black') => void;
  updateMove: (fen: string, move: LiveMove, whiteMs: number, blackMs: number, turn: 'w' | 'b') => void;
  updateClock: (whiteMs: number, blackMs: number) => void;
  setQueued: (tc: TimeControl | null) => void;
  setPrivateGame: (gameId: string, inviteCode: string) => void;
  setDrawOffer: (by: 'white' | 'black' | null) => void;
  setGameOver: (info: GameOverInfo) => void;
  reset: () => void;
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const useLiveGameStore = create<LiveGameState>((set) => ({
  gameId: null,
  game: null,
  myColor: null,
  fen: INITIAL_FEN,
  moves: [],
  turn: 'w',
  whiteTimeMs: 600_000,
  blackTimeMs: 600_000,
  isQueued: false,
  queueTimeControl: null,
  privateGameId: null,
  inviteCode: null,
  waitingForOpponent: false,
  drawOfferedBy: null,
  gameOver: null,

  setGame: (game, color) =>
    set({
      gameId: game.id,
      game,
      myColor: color,
      fen: game.fen,
      moves: game.move_history_json,
      turn: game.fen.split(' ')[1] as 'w' | 'b',
      whiteTimeMs: game.white_time_ms,
      blackTimeMs: game.black_time_ms,
      isQueued: false,
      queueTimeControl: null,
      waitingForOpponent: false,
      inviteCode: null,
      privateGameId: null,
      drawOfferedBy: null,
      gameOver: null,
    }),

  updateMove: (fen, move, whiteMs, blackMs, turn) =>
    set((s) => ({
      fen,
      moves: [...s.moves, move],
      whiteTimeMs: whiteMs,
      blackTimeMs: blackMs,
      turn,
    })),

  updateClock: (whiteMs, blackMs) =>
    set({ whiteTimeMs: whiteMs, blackTimeMs: blackMs }),

  setQueued: (tc) =>
    set({ isQueued: tc !== null, queueTimeControl: tc }),

  setPrivateGame: (gameId, inviteCode) =>
    set({
      privateGameId: gameId,
      inviteCode,
      waitingForOpponent: true,
    }),

  setDrawOffer: (by) => set({ drawOfferedBy: by }),

  setGameOver: (info) => set({ gameOver: info }),

  reset: () =>
    set({
      gameId: null,
      game: null,
      myColor: null,
      fen: INITIAL_FEN,
      moves: [],
      turn: 'w',
      whiteTimeMs: 600_000,
      blackTimeMs: 600_000,
      isQueued: false,
      queueTimeControl: null,
      privateGameId: null,
      inviteCode: null,
      waitingForOpponent: false,
      drawOfferedBy: null,
      gameOver: null,
    }),
}));
