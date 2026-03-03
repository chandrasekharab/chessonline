import { Server as SocketServer } from 'socket.io';
import { SocketWithUser, userSocketMap } from './index';
import { matchmakingService } from '../services/matchmaking.service';
import { liveGameService } from '../services/liveGame.service';
import { liveGameRepository } from '../repositories/liveGame.repository';
import { logger } from '../utils/logger';
import {
  JoinQueuePayload,
  CreatePrivateGamePayload,
  JoinPrivateGamePayload,
  MakeMovePayload,
  ResignPayload,
  OfferDrawPayload,
  AcceptDrawPayload,
  GameStartEvent,
  MoveMadeEvent,
  ClockUpdateEvent,
  TimeControl,
} from '../types';

export function registerGameHandlers(io: SocketServer, socket: SocketWithUser): void {
  // ── Matchmaking: join quick queue ─────────────────────────────────────────
  socket.on('join_queue', async (payload: JoinQueuePayload) => {
    try {
      const { timeControl } = payload;
      if (!isValidTimeControl(timeControl)) {
        socket.emit('error', { message: 'Invalid time control' });
        return;
      }

      const match = await matchmakingService.joinQueue({
        userId: socket.userId,
        email: socket.email,
        rating: 1200, // Will be fetched if needed; approximate for pairing
        timeControl,
        joinedAt: new Date(),
        socketId: socket.id,
      });

      if (match) {
        // Emit game_start to both players
        const gameView = await liveGameRepository.findByIdWithUsers(match.gameId);
        if (!gameView) return;

        const whiteSocketId = userSocketMap.get(match.whiteUserId);
        const blackSocketId = userSocketMap.get(match.blackUserId);

        if (whiteSocketId) {
          const whiteSocket = io.sockets.sockets.get(whiteSocketId);
          whiteSocket?.join(`game:${match.gameId}`);
        }
        if (blackSocketId) {
          const blackSocket = io.sockets.sockets.get(blackSocketId);
          blackSocket?.join(`game:${match.gameId}`);
        }

        io.to(`game:${match.gameId}`).emit('game_start', {});

        const ev: GameStartEvent = { game: gameView, color: 'white' };
        if (whiteSocketId) io.to(whiteSocketId).emit('game_start', ev);

        if (blackSocketId)
          io.to(blackSocketId).emit('game_start', { game: gameView, color: 'black' } as GameStartEvent);

        // Start clock
        startGameClock(io, match.gameId, match.timeMs, match.timeMs);
      } else {
        socket.emit('queued', { timeControl });
      }
    } catch (err) {
      logger.error('join_queue error', { err });
      socket.emit('error', { message: 'Failed to join queue' });
    }
  });

  // ── Leave queue ───────────────────────────────────────────────────────────
  socket.on('leave_queue', () => {
    matchmakingService.leaveQueue(socket.userId);
    socket.emit('left_queue', {});
  });

  // ── Create private game ───────────────────────────────────────────────────
  socket.on('create_private_game', async (payload: CreatePrivateGamePayload) => {
    try {
      const { timeControl } = payload;
      if (!isValidTimeControl(timeControl)) {
        socket.emit('error', { message: 'Invalid time control' });
        return;
      }

      const { gameId, inviteCode } = await matchmakingService.createPrivateGame({
        hostUserId: socket.userId,
        timeControl,
        socketId: socket.id,
      });

      socket.join(`game:${gameId}`);
      socket.emit('private_game_created', { gameId, inviteCode });
    } catch (err) {
      logger.error('create_private_game error', { err });
      socket.emit('error', { message: 'Failed to create private game' });
    }
  });

  // ── Join private game ─────────────────────────────────────────────────────
  socket.on('join_private_game', async (payload: JoinPrivateGamePayload) => {
    try {
      const result = await matchmakingService.joinPrivateGame({
        inviteCode: payload.inviteCode.toUpperCase(),
        guestUserId: socket.userId,
        socketId: socket.id,
      });

      if (!result) {
        socket.emit('error', { message: 'Invalid invite code or game already started' });
        return;
      }

      const { game } = result;
      socket.join(`game:${game!.id}`);

      // Find host socket and join room
      const hostSocketId = userSocketMap.get(game!.white_user_id!);

      const gameView = await liveGameRepository.findByIdWithUsers(game!.id);
      if (!gameView) return;

      // Notify both
      if (hostSocketId) io.to(hostSocketId).emit('game_start', { game: gameView, color: 'white' } as GameStartEvent);
      socket.emit('game_start', { game: gameView, color: 'black' } as GameStartEvent);

      // Start clock
      const timeMs = game!.white_time_ms;
      startGameClock(io, game!.id, timeMs, timeMs);
    } catch (err) {
      logger.error('join_private_game error', { err });
      socket.emit('error', { message: 'Failed to join private game' });
    }
  });

  // ── Reconnect to active game ──────────────────────────────────────────────
  socket.on('reconnect_game', async (payload: { gameId: string }) => {
    try {
      const game = await liveGameRepository.findByIdWithUsers(payload.gameId);
      if (!game) { socket.emit('error', { message: 'Game not found' }); return; }
      if (game.white_user_id !== socket.userId && game.black_user_id !== socket.userId) {
        socket.emit('error', { message: 'Not a player in this game' });
        return;
      }
      socket.join(`game:${payload.gameId}`);
      const color = game.white_user_id === socket.userId ? 'white' : 'black';
      socket.emit('game_start', { game, color } as GameStartEvent);
    } catch (err) {
      logger.error('reconnect_game error', { err });
    }
  });

  // ── Make move ─────────────────────────────────────────────────────────────
  socket.on('make_move', async (payload: MakeMovePayload) => {
    try {
      const result = await liveGameService.applyMove({
        gameId: payload.gameId,
        userId: socket.userId,
        uci: payload.uci,
      });

      if (!result.success) {
        socket.emit('illegal_move', { error: result.error });
        return;
      }

      const moveEvent: MoveMadeEvent = {
        gameId: payload.gameId,
        move: result.move!,
        fen: result.fen!,
        white_time_ms: result.white_time_ms!,
        black_time_ms: result.black_time_ms!,
        turn: result.turn!,
      };

      io.to(`game:${payload.gameId}`).emit('move_made', moveEvent);

      if (result.gameOver) {
        io.to(`game:${payload.gameId}`).emit('game_over', result.gameOver);
        liveGameService.stopClock(payload.gameId);
      }
    } catch (err) {
      logger.error('make_move error', { err });
      socket.emit('error', { message: 'Move failed' });
    }
  });

  // ── Resign ────────────────────────────────────────────────────────────────
  socket.on('resign', async (payload: ResignPayload) => {
    try {
      const gameOverEvent = await liveGameService.resign(payload.gameId, socket.userId);
      if (gameOverEvent) {
        io.to(`game:${payload.gameId}`).emit('game_over', gameOverEvent);
      }
    } catch (err) {
      logger.error('resign error', { err });
    }
  });

  // ── Offer draw ────────────────────────────────────────────────────────────
  socket.on('offer_draw', async (payload: OfferDrawPayload) => {
    try {
      const game = await liveGameRepository.findById(payload.gameId);
      if (!game) return;
      const side = liveGameService.offerDraw(payload.gameId, socket.userId, game);
      if (side) {
        io.to(`game:${payload.gameId}`).emit('draw_offered', { gameId: payload.gameId, by: side });
      }
    } catch (err) {
      logger.error('offer_draw error', { err });
    }
  });

  // ── Accept draw ───────────────────────────────────────────────────────────
  socket.on('accept_draw', async (payload: AcceptDrawPayload) => {
    try {
      const gameOverEvent = await liveGameService.acceptDraw(payload.gameId, socket.userId);
      if (gameOverEvent) {
        io.to(`game:${payload.gameId}`).emit('game_over', gameOverEvent);
      }
    } catch (err) {
      logger.error('accept_draw error', { err });
    }
  });

  // ── Decline draw ─────────────────────────────────────────────────────────
  socket.on('decline_draw', (payload: { gameId: string }) => {
    io.to(`game:${payload.gameId}`).emit('draw_declined', { gameId: payload.gameId });
  });
}

// ── Clock tick emission ──────────────────────────────────────────────────────
function startGameClock(
  io: SocketServer,
  gameId: string,
  whiteTimeMs: number,
  blackTimeMs: number
): void {
  liveGameService.startClock(
    gameId,
    whiteTimeMs,
    blackTimeMs,
    'w',
    (clock) => {
      const event: ClockUpdateEvent = {
        gameId,
        white_time_ms: clock.whiteTimeMs,
        black_time_ms: clock.blackTimeMs,
      };
      io.to(`game:${gameId}`).emit('clock_update', event);
    },
    async (loser) => {
      const gameOverEvent = await liveGameService.handleTimeout(gameId, loser);
      io.to(`game:${gameId}`).emit('game_over', gameOverEvent);
    }
  );
}

function isValidTimeControl(tc: string): tc is TimeControl {
  return ['bullet', 'blitz', 'rapid'].includes(tc);
}
