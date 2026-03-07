import { create } from 'zustand';
import type {
  ConsultationGame, ConsultationSuggestion,
  ConsultationSide, ConsultationChatMsgEvent,
  LiveMove, GameWinner, GameTermination,
} from '../types';

export interface ConsultationGameOver {
  winner: GameWinner | null;
  termination: GameTermination;
}

interface ConsultationState {
  // Active game
  game: ConsultationGame | null;
  mySide: ConsultationSide | null;
  myUserId: string | null;

  // Board state
  fen: string;
  moves: LiveMove[];
  turn: 'w' | 'b';
  whiteTimeMs: number;
  blackTimeMs: number;

  // Suggestions for the current turn
  suggestions: ConsultationSuggestion[];

  // Team chat - keyed by side so we store both
  chatMessages: ConsultationChatMsgEvent[];

  // Lobby / invite
  inviteCode: string | null;
  waitingForOpponent: boolean;

  // Game over
  gameOver: ConsultationGameOver | null;

  // Actions
  setGame: (game: ConsultationGame, side: ConsultationSide, userId: string) => void;
  setWaiting: (inviteCode: string) => void;
  onGameStarted: (game: ConsultationGame) => void;
  updateMove: (fen: string, move: LiveMove, whiteMs: number, blackMs: number, turn: 'w' | 'b') => void;
  updateClock: (whiteMs: number, blackMs: number) => void;
  setSuggestions: (suggestions: ConsultationSuggestion[]) => void;
  addChatMessage: (msg: ConsultationChatMsgEvent) => void;
  setGameOver: (info: ConsultationGameOver) => void;
  reset: () => void;
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const INITIAL: Omit<ConsultationState,
  'setGame' | 'setWaiting' | 'onGameStarted' | 'updateMove' | 'updateClock' |
  'setSuggestions' | 'addChatMessage' | 'setGameOver' | 'reset'
> = {
  game: null,
  mySide: null,
  myUserId: null,
  fen: INITIAL_FEN,
  moves: [],
  turn: 'w',
  whiteTimeMs: 600_000,
  blackTimeMs: 600_000,
  suggestions: [],
  chatMessages: [],
  inviteCode: null,
  waitingForOpponent: false,
  gameOver: null,
};

export const useConsultationStore = create<ConsultationState>((set) => ({
  ...INITIAL,

  setGame: (game, side, userId) => set({
    game,
    mySide: side,
    myUserId: userId,
    fen: game.fen,
    moves: game.move_history_json,
    turn: game.fen.split(' ')[1] as 'w' | 'b',
    whiteTimeMs: game.white_time_ms,
    blackTimeMs: game.black_time_ms,
    inviteCode: game.invite_code,
    waitingForOpponent: game.status === 'waiting',
    gameOver: null,
  }),

  setWaiting: (inviteCode) => set({ inviteCode, waitingForOpponent: true }),

  onGameStarted: (game) => set({
    game,
    fen: game.fen,
    moves: game.move_history_json,
    turn: game.fen.split(' ')[1] as 'w' | 'b',
    whiteTimeMs: game.white_time_ms,
    blackTimeMs: game.black_time_ms,
    waitingForOpponent: false,
  }),

  updateMove: (fen, move, whiteMs, blackMs, turn) =>
    set((s) => ({
      fen,
      moves: [...s.moves, move],
      turn,
      whiteTimeMs: whiteMs,
      blackTimeMs: blackMs,
      suggestions: [], // clear for new turn
    })),

  updateClock: (whiteMs, blackMs) => set({ whiteTimeMs: whiteMs, blackTimeMs: blackMs }),

  setSuggestions: (suggestions) => set({ suggestions }),

  addChatMessage: (msg) =>
    set((s) => ({ chatMessages: [...s.chatMessages.slice(-199), msg] })),

  setGameOver: (info) => set({ gameOver: info }),

  reset: () => set(INITIAL),
}));
