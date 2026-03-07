import { Chess } from 'chess.js';
import { consultationRepository } from '../repositories/consultation.repository';
import { userRepository } from '../repositories/user.repository';
import {
  ConsultationGame, ConsultationSuggestion,
  ConsultationSide, GameWinner, GameTermination,
  LiveMove, TimeControl, TIME_CONTROL_MS,
} from '../types';
import { logger } from '../utils/logger';

export interface ConsultationMoveResult {
  success: boolean;
  error?: string;
  fen?: string;
  move?: LiveMove;
  white_time_ms?: number;
  black_time_ms?: number;
  turn?: 'w' | 'b';
  gameOver?: { winner: GameWinner | null; termination: GameTermination };
}

// In-memory clock for consultation games (same pattern as LiveGameService)
interface ConsultationClock {
  gameId: string;
  whiteTimeMs: number;
  blackTimeMs: number;
  lastTickAt: number;
  currentTurn: 'w' | 'b';
  intervalId: ReturnType<typeof setInterval>;
}

const activeClocks = new Map<string, ConsultationClock>();

class ConsultationService {
  // ── Game lifecycle ─────────────────────────────────────────────────────────

  async createGame(params: {
    whitePlayer1Id: string;
    whitePlayer2Id?: string;
    whiteTeamId?: string;
    timeControl: TimeControl;
  }): Promise<ConsultationGame> {
    const timeMs = TIME_CONTROL_MS[params.timeControl];
    const game = await consultationRepository.create({
      whitePlayer1Id: params.whitePlayer1Id,
      whitePlayer2Id: params.whitePlayer2Id,
      whiteTeamId: params.whiteTeamId,
      whiteExecutorId: params.whitePlayer1Id,
      timeControl: params.timeControl,
      whiteTimeMs: timeMs,
      blackTimeMs: timeMs,
    });
    logger.info('Consultation game created', { gameId: game.id });
    return game;
  }

  async joinGame(params: {
    inviteCode: string;
    blackPlayer1Id: string;
    blackPlayer2Id?: string;
    blackTeamId?: string;
  }): Promise<ConsultationGame> {
    const game = await consultationRepository.findByInviteCode(params.inviteCode.toUpperCase());
    if (!game) throw Object.assign(new Error('Invalid invite code or game not available'), { status: 404 });
    if (game.status !== 'waiting') throw Object.assign(new Error('Game already started'), { status: 400 });

    await consultationRepository.setBlackSide(game.id, {
      blackPlayer1Id: params.blackPlayer1Id,
      blackPlayer2Id: params.blackPlayer2Id,
      blackTeamId: params.blackTeamId,
      blackExecutorId: params.blackPlayer1Id,
    });

    return (await consultationRepository.findById(game.id))!;
  }

  async getGame(id: string): Promise<ConsultationGame> {
    const g = await consultationRepository.findById(id);
    if (!g) throw Object.assign(new Error('Consultation game not found'), { status: 404 });
    return g;
  }

  // ── Move suggestion flow ───────────────────────────────────────────────────

  async suggestMove(gameId: string, userId: string, uci: string): Promise<ConsultationSuggestion> {
    const game = await this.getGame(gameId);
    if (game.status !== 'active') throw Object.assign(new Error('Game is not active'), { status: 400 });

    const side = this.getUserSide(game, userId);
    if (!side) throw Object.assign(new Error('You are not a player in this game'), { status: 403 });

    const chess = new Chess(game.fen);
    const currentTurnSide: ConsultationSide = chess.turn() === 'w' ? 'white' : 'black';
    if (side !== currentTurnSide) throw Object.assign(new Error("It's not your team's turn"), { status: 400 });

    // Validate move
    try {
      const moveObj = chess.move(uci.length === 4 || uci.length === 5
        ? { from: uci.slice(0, 2) as never, to: uci.slice(2, 4) as never, promotion: uci[4] }
        : uci
      );
      if (!moveObj) throw new Error('illegal');

      const moveCount = game.move_history_json.length;
      return consultationRepository.addSuggestion({
        gameId,
        suggestedBy: userId,
        uci,
        san: moveObj.san,
        moveNumber: Math.floor(moveCount / 2) + 1,
        side,
      });
    } catch {
      throw Object.assign(new Error('Illegal move'), { status: 400 });
    }
  }

  async voteSuggestion(gameId: string, userId: string, suggestionId: string): Promise<ConsultationSuggestion> {
    const game = await this.getGame(gameId);
    const side = this.getUserSide(game, userId);
    if (!side) throw Object.assign(new Error('You are not a player in this game'), { status: 403 });
    return consultationRepository.vote(suggestionId, userId);
  }

  async getSuggestions(gameId: string, userId: string): Promise<ConsultationSuggestion[]> {
    const game = await this.getGame(gameId);
    const side = this.getUserSide(game, userId);
    if (!side) throw Object.assign(new Error('You are not a player in this game'), { status: 403 });
    const chess = new Chess(game.fen);
    const currentSide: ConsultationSide = chess.turn() === 'w' ? 'white' : 'black';
    const moveNumber = Math.floor(game.move_history_json.length / 2) + 1;
    return consultationRepository.getSuggestions(gameId, moveNumber, currentSide);
  }

  async executeMove(
    gameId: string,
    executorId: string,
    suggestionId: string,
    onGameEvent: (event: 'move' | 'gameover', data: ConsultationMoveResult) => void,
  ): Promise<ConsultationMoveResult> {
    const game = await this.getGame(gameId);
    if (game.status !== 'active') return { success: false, error: 'Game is not active' };

    const side = this.getUserSide(game, executorId);
    if (!side) return { success: false, error: 'Not a player in this game' };

    // Only the executor for that side can submit
    const executorId_ = side === 'white' ? game.white_executor_id : game.black_executor_id;
    if (executorId_ !== executorId) {
      return { success: false, error: 'Only the designated executor can submit moves' };
    }

    const chess = new Chess(game.fen);
    const currentSide: ConsultationSide = chess.turn() === 'w' ? 'white' : 'black';
    if (side !== currentSide) return { success: false, error: "Not your team's turn" };

    // Fetch the suggestion
    const moveNumber = Math.floor(game.move_history_json.length / 2) + 1;
    const suggestions = await consultationRepository.getSuggestions(gameId, moveNumber, side);
    const suggestion = suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return { success: false, error: 'Suggestion not found' };

    const uci = suggestion.uci;
    let moveObj;
    try {
      moveObj = chess.move(uci.length >= 4
        ? { from: uci.slice(0, 2) as never, to: uci.slice(2, 4) as never, promotion: uci[4] }
        : uci
      );
      if (!moveObj) throw new Error('illegal');
    } catch {
      return { success: false, error: 'Illegal move (may have been invalidated)' };
    }

    const newFen = chess.fen();
    const clock = activeClocks.get(gameId);
    const nowMs = Date.now();
    let whiteMs = game.white_time_ms;
    let blackMs = game.black_time_ms;
    if (clock) {
      const elapsed = nowMs - clock.lastTickAt;
      if (side === 'white') whiteMs = Math.max(0, whiteMs - elapsed);
      else blackMs = Math.max(0, blackMs - elapsed);
      clock.lastTickAt = nowMs;
      clock.currentTurn = chess.turn() as 'w' | 'b';
    }

    const liveMove: LiveMove = {
      san: moveObj.san,
      uci,
      fen: newFen,
      timestamp: nowMs,
    };

    await consultationRepository.applyMove(gameId, newFen, liveMove, whiteMs, blackMs);
    await consultationRepository.markExecuted(suggestionId);

    const result: ConsultationMoveResult = {
      success: true,
      fen: newFen,
      move: liveMove,
      white_time_ms: whiteMs,
      black_time_ms: blackMs,
      turn: chess.turn() as 'w' | 'b',
    };

    // Check game over
    if (chess.isGameOver()) {
      let winner: GameWinner | null = null;
      let termination: GameTermination = 'normal';
      if (chess.isCheckmate()) {
        winner = side === 'white' ? 'white' : 'black';
        termination = 'normal';
      } else if (chess.isDraw()) {
        winner = 'draw';
        termination = 'draw_agreement';
      }
      await consultationRepository.updateStatus(gameId, 'completed', winner ?? undefined, termination);
      this.stopClock(gameId);
      result.gameOver = { winner, termination };
    }

    onGameEvent(result.gameOver ? 'gameover' : 'move', result);
    return result;
  }

  async resign(gameId: string, userId: string): Promise<{ winner: GameWinner; termination: GameTermination }> {
    const game = await this.getGame(gameId);
    const side = this.getUserSide(game, userId);
    if (!side) throw Object.assign(new Error('Not a player in this game'), { status: 403 });

    const winner: GameWinner = side === 'white' ? 'black' : 'white';
    await consultationRepository.updateStatus(gameId, 'completed', winner, 'resignation');
    this.stopClock(gameId);
    return { winner, termination: 'resignation' };
  }

  // ── Clocks ─────────────────────────────────────────────────────────────────

  startClock(
    gameId: string,
    whiteMs: number,
    blackMs: number,
    currentTurn: 'w' | 'b',
    onTick: (clock: ConsultationClock) => void,
    onTimeout: (loser: 'white' | 'black') => void,
  ): void {
    this.stopClock(gameId);
    const clock: ConsultationClock = {
      gameId, whiteTimeMs: whiteMs, blackTimeMs: blackMs,
      lastTickAt: Date.now(), currentTurn,
      intervalId: setInterval(() => {
        const now = Date.now();
        const elapsed = now - clock.lastTickAt;
        clock.lastTickAt = now;
        if (clock.currentTurn === 'w') {
          clock.whiteTimeMs -= elapsed;
          if (clock.whiteTimeMs <= 0) {
            clock.whiteTimeMs = 0;
            this.stopClock(gameId);
            onTimeout('white');
            return;
          }
        } else {
          clock.blackTimeMs -= elapsed;
          if (clock.blackTimeMs <= 0) {
            clock.blackTimeMs = 0;
            this.stopClock(gameId);
            onTimeout('black');
            return;
          }
        }
        onTick(clock);
      }, 500),
    };
    activeClocks.set(gameId, clock);
  }

  stopClock(gameId: string): void {
    const c = activeClocks.get(gameId);
    if (c) { clearInterval(c.intervalId); activeClocks.delete(gameId); }
  }

  getClock(gameId: string): ConsultationClock | undefined {
    return activeClocks.get(gameId);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  getUserSide(game: ConsultationGame, userId: string): ConsultationSide | null {
    if (game.white_player1_id === userId || game.white_player2_id === userId) return 'white';
    if (game.black_player1_id === userId || game.black_player2_id === userId) return 'black';
    return null;
  }
}

export const consultationService = new ConsultationService();
