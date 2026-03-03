import { EventEmitter } from 'events';
import { TimeControl, TIME_CONTROL_MS } from '../types';
import { liveGameRepository } from '../repositories/liveGame.repository';
import { logger } from '../utils/logger';

export interface QueueEntry {
  userId: string;
  email: string;
  rating: number;
  timeControl: TimeControl;
  joinedAt: Date;
  socketId: string;
}

export interface MatchResult {
  gameId: string;
  whiteUserId: string;
  blackUserId: string;
  whiteSocketId: string;
  blackSocketId: string;
  timeControl: TimeControl;
  timeMs: number;
}

class MatchmakingService extends EventEmitter {
  // Map of timeControl → waiting queue
  private queues: Map<TimeControl, QueueEntry[]> = new Map([
    ['bullet', []],
    ['blitz', []],
    ['rapid', []],
  ]);

  async joinQueue(entry: QueueEntry): Promise<MatchResult | null> {
    const queue = this.queues.get(entry.timeControl)!;

    // Remove stale entries (same user already in queue)
    const filtered = queue.filter((e) => e.userId !== entry.userId);
    this.queues.set(entry.timeControl, filtered);

    if (filtered.length === 0) {
      filtered.push(entry);
      logger.info('Player joined queue', { userId: entry.userId, timeControl: entry.timeControl });
      return null;
    }

    // Match with the first waiting player (closest rating preferred in a real system)
    const opponent = filtered.shift()!;
    this.queues.set(entry.timeControl, filtered);

    // Randomly assign colors
    const [white, black] =
      Math.random() < 0.5 ? [entry, opponent] : [opponent, entry];

    const timeMs = TIME_CONTROL_MS[entry.timeControl];

    const game = await liveGameRepository.create({
      whiteUserId: white.userId,
      blackUserId: black.userId,
      timeControl: entry.timeControl,
      whiteTimeMs: timeMs,
      blackTimeMs: timeMs,
    });

    // Immediately mark as active (both players present)
    await liveGameRepository.setBlackPlayer(game.id, black.userId);

    logger.info('Match found', {
      gameId: game.id,
      white: white.userId,
      black: black.userId,
    });

    return {
      gameId: game.id,
      whiteUserId: white.userId,
      blackUserId: black.userId,
      whiteSocketId: white.socketId,
      blackSocketId: black.socketId,
      timeControl: entry.timeControl,
      timeMs,
    };
  }

  leaveQueue(userId: string): void {
    for (const [tc, queue] of this.queues) {
      this.queues.set(
        tc,
        queue.filter((e) => e.userId !== userId)
      );
    }
  }

  async createPrivateGame(params: {
    hostUserId: string;
    timeControl: TimeControl;
    socketId: string;
  }): Promise<{ gameId: string; inviteCode: string }> {
    const inviteCode = Math.random().toString(36).toUpperCase().slice(2, 8);
    const timeMs = TIME_CONTROL_MS[params.timeControl];

    const game = await liveGameRepository.create({
      whiteUserId: params.hostUserId,
      blackUserId: null,
      timeControl: params.timeControl,
      whiteTimeMs: timeMs,
      blackTimeMs: timeMs,
      inviteCode,
    });

    logger.info('Private game created', {
      gameId: game.id,
      inviteCode,
      host: params.hostUserId,
    });

    return { gameId: game.id, inviteCode };
  }

  async joinPrivateGame(params: {
    inviteCode: string;
    guestUserId: string;
    socketId: string;
  }): Promise<{ game: Awaited<ReturnType<typeof liveGameRepository.findById>>; result: MatchResult } | null> {
    const game = await liveGameRepository.findByInviteCode(params.inviteCode);
    if (!game || game.white_user_id === params.guestUserId) return null;

    await liveGameRepository.setBlackPlayer(game.id, params.guestUserId);
    const timeMs = TIME_CONTROL_MS[game.time_control];

    const result: MatchResult = {
      gameId: game.id,
      whiteUserId: game.white_user_id!,
      blackUserId: params.guestUserId,
      whiteSocketId: '', // filled in by socket handler from room tracking
      blackSocketId: params.socketId,
      timeControl: game.time_control,
      timeMs,
    };

    return { game, result };
  }
}

export const matchmakingService = new MatchmakingService();
