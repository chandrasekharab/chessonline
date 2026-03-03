import { Chess } from 'chess.js';
import { liveGameRepository } from '../repositories/liveGame.repository';
import { userRepository } from '../repositories/user.repository';
import { analysisQueue } from '../queue/analysisQueue';
import { calculateElo } from './elo.service';
import { logger } from '../utils/logger';
import {
  LiveGame,
  LiveMove,
  GameWinner,
  GameTermination,
  GameOverEvent,
} from '../types';

export interface MoveResult {
  success: boolean;
  error?: string;
  fen?: string;
  move?: LiveMove;
  white_time_ms?: number;
  black_time_ms?: number;
  turn?: 'w' | 'b';
  gameOver?: GameOverEvent;
}

export interface ActiveClock {
  gameId: string;
  whiteTimeMs: number;
  blackTimeMs: number;
  lastTickAt: number;            // Date.now()
  currentTurn: 'w' | 'b';
  intervalId: ReturnType<typeof setInterval>;
}

// In-memory clock map
const activeClocks = new Map<string, ActiveClock>();

// In-memory draw offer tracking: gameId → who offered
const drawOffers = new Map<string, 'white' | 'black'>();

class LiveGameService {
  startClock(
    gameId: string,
    whiteTimeMs: number,
    blackTimeMs: number,
    currentTurn: 'w' | 'b',
    onTick: (clock: ActiveClock) => void,
    onTimeout: (loser: 'white' | 'black') => void
  ): void {
    this.stopClock(gameId);

    const clock: ActiveClock = {
      gameId,
      whiteTimeMs,
      blackTimeMs,
      lastTickAt: Date.now(),
      currentTurn,
      intervalId: setInterval(async () => {
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
    const clock = activeClocks.get(gameId);
    if (clock) {
      clearInterval(clock.intervalId);
      activeClocks.delete(gameId);
    }
  }

  getClock(gameId: string): ActiveClock | null {
    return activeClocks.get(gameId) ?? null;
  }

  async applyMove(params: {
    gameId: string;
    userId: string;
    uci: string;
  }): Promise<MoveResult> {
    const game = await liveGameRepository.findById(params.gameId);
    if (!game) return { success: false, error: 'Game not found' };
    if (game.status !== 'active') return { success: false, error: 'Game is not active' };

    // Verify it's the player's turn
    const chess = new Chess(game.fen);
    const turn = chess.turn(); // 'w' or 'b'
    const isWhite = game.white_user_id === params.userId;
    const isBlack = game.black_user_id === params.userId;

    if (!isWhite && !isBlack) return { success: false, error: 'Not a player in this game' };
    if (turn === 'w' && !isWhite) return { success: false, error: 'Not your turn' };
    if (turn === 'b' && !isBlack) return { success: false, error: 'Not your turn' };

    // Validate and apply move
    const from = params.uci.slice(0, 2);
    const to = params.uci.slice(2, 4);
    const promotion = params.uci.length === 5 ? params.uci[4] : undefined;

    let moveResult;
    try {
      moveResult = chess.move({ from, to, promotion });
    } catch {
      return { success: false, error: 'Illegal move' };
    }

    if (!moveResult) return { success: false, error: 'Illegal move' };

    // Update clock based on elapsed time since last move
    const clock = activeClocks.get(params.gameId);
    let whiteTimeMs = game.white_time_ms;
    let blackTimeMs = game.black_time_ms;

    if (clock) {
      const elapsed = Date.now() - clock.lastTickAt;
      if (turn === 'w') {
        whiteTimeMs = Math.max(0, clock.whiteTimeMs - elapsed);
        clock.whiteTimeMs = whiteTimeMs;
      } else {
        blackTimeMs = Math.max(0, clock.blackTimeMs - elapsed);
        clock.blackTimeMs = blackTimeMs;
      }
      clock.lastTickAt = Date.now();
      clock.currentTurn = chess.turn();
    }

    const newFen = chess.fen();
    const liveMove: LiveMove = {
      san: moveResult.san,
      uci: params.uci,
      fen: newFen,
      timestamp: Date.now(),
    };

    const moveHistory: LiveMove[] = [...(game.move_history_json as LiveMove[]), liveMove];

    await liveGameRepository.updateMove({
      id: params.gameId,
      fen: newFen,
      moveHistory,
      whiteTimeMs,
      blackTimeMs,
    });

    // Clear draw offers after a move
    drawOffers.delete(params.gameId);

    const newTurn = chess.turn();

    // Check for game over
    let gameOverEvent: GameOverEvent | undefined;

    if (chess.isGameOver()) {
      this.stopClock(params.gameId);
      let winner: GameWinner | null = null;
      let termination: GameTermination = 'normal';

      if (chess.isCheckmate()) {
        winner = turn === 'w' ? 'white' : 'black'; // the player who just moved wins
      } else {
        winner = 'draw';
      }

      gameOverEvent = await this.finalizeGame({ gameId: params.gameId, winner, termination });
    }

    return {
      success: true,
      fen: newFen,
      move: liveMove,
      white_time_ms: whiteTimeMs,
      black_time_ms: blackTimeMs,
      turn: newTurn,
      gameOver: gameOverEvent,
    };
  }

  async resign(gameId: string, userId: string): Promise<GameOverEvent | null> {
    const game = await liveGameRepository.findById(gameId);
    if (!game || game.status !== 'active') return null;

    const isWhite = game.white_user_id === userId;
    const isBlack = game.black_user_id === userId;
    if (!isWhite && !isBlack) return null;

    const winner: GameWinner = isWhite ? 'black' : 'white';
    this.stopClock(gameId);
    return this.finalizeGame({ gameId, winner, termination: 'resignation' });
  }

  offerDraw(gameId: string, userId: string, game: LiveGame): 'white' | 'black' | null {
    const isWhite = game.white_user_id === userId;
    const isBlack = game.black_user_id === userId;
    if (!isWhite && !isBlack) return null;
    const side = isWhite ? 'white' : 'black';
    drawOffers.set(gameId, side);
    return side;
  }

  async acceptDraw(gameId: string, userId: string): Promise<GameOverEvent | null> {
    const game = await liveGameRepository.findById(gameId);
    if (!game || game.status !== 'active') return null;

    const offeredBy = drawOffers.get(gameId);
    if (!offeredBy) return null;

    const respondingSide = game.white_user_id === userId ? 'white' : 'black';
    if (respondingSide === offeredBy) return null; // can't accept your own offer

    drawOffers.delete(gameId);
    this.stopClock(gameId);
    return this.finalizeGame({ gameId, winner: 'draw', termination: 'draw_agreement' });
  }

  async handleTimeout(gameId: string, loser: 'white' | 'black'): Promise<GameOverEvent> {
    const winner: GameWinner = loser === 'white' ? 'black' : 'white';
    return this.finalizeGame({ gameId, winner, termination: 'timeout' });
  }

  private async finalizeGame(params: {
    gameId: string;
    winner: GameWinner | null;
    termination: GameTermination;
  }): Promise<GameOverEvent> {
    const { gameId, winner, termination } = params;

    const game = await liveGameRepository.findById(gameId);
    let whiteRatingChange: number | undefined;
    let blackRatingChange: number | undefined;

    if (game && game.white_user_id && game.black_user_id && winner !== null) {
      const whiteUser = await userRepository.findById(game.white_user_id);
      const blackUser = await userRepository.findById(game.black_user_id);

      if (whiteUser && blackUser) {
        const eloResult = winner === 'draw' ? 'draw' : winner;
        const elo = calculateElo(whiteUser.rating, blackUser.rating, eloResult);

        await userRepository.updateRating(whiteUser.id, elo.newWhiteRating);
        await userRepository.updateRating(blackUser.id, elo.newBlackRating);

        await liveGameRepository.saveRatingHistory({
          userId: whiteUser.id,
          liveGameId: gameId,
          ratingBefore: whiteUser.rating,
          ratingAfter: elo.newWhiteRating,
          ratingChange: elo.whiteChange,
        });
        await liveGameRepository.saveRatingHistory({
          userId: blackUser.id,
          liveGameId: gameId,
          ratingBefore: blackUser.rating,
          ratingAfter: elo.newBlackRating,
          ratingChange: elo.blackChange,
        });

        whiteRatingChange = elo.whiteChange;
        blackRatingChange = elo.blackChange;
      }
    }

    // Trigger async analysis if game had moves
    let analysisGameId: string | undefined;
    if (game && (game.move_history_json as LiveMove[]).length >= 2) {
      try {
        const pgn = this.buildPgn(game);
        const { gamesService } = await import('./games.service');
        const analysisGame = await gamesService.createGame(game.white_user_id!, pgn);
        analysisGameId = analysisGame.id;

        await liveGameRepository.complete({
          id: gameId,
          winner,
          termination,
          analysisGameId,
        });

        // Enqueue analysis
        await analysisQueue.add('analyse', {
          gameId: analysisGameId,
          userId: game.white_user_id!,
          depth: 18,
        });

        logger.info('Post-game analysis queued', { analysisGameId, liveGameId: gameId });
      } catch (err) {
        logger.error('Failed to queue post-game analysis', { err });
        await liveGameRepository.complete({ id: gameId, winner, termination });
      }
    } else {
      await liveGameRepository.complete({ id: gameId, winner, termination });
    }

    return {
      gameId,
      winner,
      termination,
      white_rating_change: whiteRatingChange,
      black_rating_change: blackRatingChange,
      analysis_game_id: analysisGameId,
    };
  }

  private buildPgn(game: LiveGame): string {
    const moves = game.move_history_json as LiveMove[];
    const chess = new Chess();
    for (const m of moves) {
      chess.move(m.san);
    }
    return chess.pgn();
  }
}

export const liveGameService = new LiveGameService();
