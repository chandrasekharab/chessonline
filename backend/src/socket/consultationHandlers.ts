import { Server as SocketServer } from 'socket.io';
import { SocketWithUser, userSocketMap } from './index';
import { consultationService } from '../services/consultation.service';
import { consultationRepository } from '../repositories/consultation.repository';
import { logger } from '../utils/logger';
import {
  SuggestMovePayload, VoteMovePayload, ExecuteMovePayload,
  ConsultationChatPayload, TimeControl,
} from '../types';

interface CreateConsultationPayload {
  timeControl: TimeControl;
  whitePlayer2Id?: string;
  whiteTeamId?: string;
}

interface JoinConsultationPayload {
  inviteCode: string;
  blackPlayer2Id?: string;
  blackTeamId?: string;
}

export function registerConsultationHandlers(io: SocketServer, socket: SocketWithUser): void {
  // ── Create a 2v2 consultation game ─────────────────────────────────────────
  socket.on('consultation:create', async (payload: CreateConsultationPayload) => {
    try {
      const game = await consultationService.createGame({
        whitePlayer1Id: socket.userId,
        whitePlayer2Id: payload.whitePlayer2Id,
        whiteTeamId:    payload.whiteTeamId,
        timeControl:    payload.timeControl ?? 'rapid',
      });

      socket.join(`consultation:${game.id}`);
      socket.emit('consultation:created', { game });
      logger.info('Consultation game created', { gameId: game.id, userId: socket.userId });
    } catch (err) {
      logger.error('consultation:create error', { err });
      socket.emit('error', { message: 'Failed to create consultation game' });
    }
  });

  // ── Join as black side ──────────────────────────────────────────────────────
  socket.on('consultation:join', async (payload: JoinConsultationPayload) => {
    try {
      const game = await consultationService.joinGame({
        inviteCode:     payload.inviteCode,
        blackPlayer1Id: socket.userId,
        blackPlayer2Id: payload.blackPlayer2Id,
        blackTeamId:    payload.blackTeamId,
      });

      socket.join(`consultation:${game.id}`);

      // Notify all players in the room
      io.to(`consultation:${game.id}`).emit('consultation:started', { game });

      // Start clock
      const timeMs = game.white_time_ms;
      consultationService.startClock(
        game.id,
        timeMs,
        timeMs,
        'w',
        (clock) => {
          io.to(`consultation:${game.id}`).emit('consultation:clock', {
            gameId: game.id,
            white_time_ms: clock.whiteTimeMs,
            black_time_ms: clock.blackTimeMs,
          });
        },
        async (loser) => {
          const winner = loser === 'white' ? 'black' : 'white';
          await consultationRepository.updateStatus(game.id, 'completed', winner, 'timeout');
          io.to(`consultation:${game.id}`).emit('consultation:gameover', {
            gameId: game.id, winner, termination: 'timeout',
          });
        },
      );

      logger.info('Consultation game joined', { gameId: game.id, userId: socket.userId });
    } catch (err) {
      logger.error('consultation:join error', { err });
      socket.emit('error', { message: (err as Error).message ?? 'Failed to join consultation game' });
    }
  });

  // ── Spectator joins ─────────────────────────────────────────────────────────
  socket.on('consultation:spectate', async (payload: { gameId: string }) => {
    try {
      const game = await consultationService.getGame(payload.gameId);
      socket.join(`consultation:${game.id}`);
      socket.emit('consultation:state', { game });
    } catch (err) {
      socket.emit('error', { message: 'Game not found' });
    }
  });

  // ── Reconnect ───────────────────────────────────────────────────────────────
  socket.on('consultation:reconnect', async (payload: { gameId: string }) => {
    try {
      const game = await consultationService.getGame(payload.gameId);
      const side = consultationService.getUserSide(game, socket.userId);
      if (!side) { socket.emit('error', { message: 'Not a player in this game' }); return; }
      socket.join(`consultation:${game.id}`);
      socket.emit('consultation:state', { game });
    } catch (err) {
      socket.emit('error', { message: 'Game not found' });
    }
  });

  // ── Suggest a move ──────────────────────────────────────────────────────────
  socket.on('consultation:suggest', async (payload: SuggestMovePayload) => {
    try {
      const suggestion = await consultationService.suggestMove(
        payload.gameId, socket.userId, payload.uci,
      );
      const game = await consultationService.getGame(payload.gameId);
      const chess = (await import('chess.js')).Chess;
      const c = new chess(game.fen);
      const moveNumber = Math.floor(game.move_history_json.length / 2) + 1;
      const side = c.turn() === 'w' ? 'white' : 'black';

      // Broadcast updated suggestions to the team side (same room)
      io.to(`consultation:${payload.gameId}`).emit('consultation:suggestions', {
        gameId: payload.gameId,
        moveNumber,
        side,
        suggestions: await consultationRepository.getSuggestions(payload.gameId, moveNumber, side),
      });
    } catch (err) {
      socket.emit('error', { message: (err as Error).message ?? 'Failed to suggest move' });
    }
  });

  // ── Vote on a suggestion ───────────────────────────────────────────────────
  socket.on('consultation:vote', async (payload: VoteMovePayload) => {
    try {
      await consultationService.voteSuggestion(payload.gameId, socket.userId, payload.suggestionId);
      const game = await consultationService.getGame(payload.gameId);
      const chess = (await import('chess.js')).Chess;
      const c = new chess(game.fen);
      const moveNumber = Math.floor(game.move_history_json.length / 2) + 1;
      const side = c.turn() === 'w' ? 'white' : 'black';

      io.to(`consultation:${payload.gameId}`).emit('consultation:suggestions', {
        gameId: payload.gameId,
        moveNumber,
        side,
        suggestions: await consultationRepository.getSuggestions(payload.gameId, moveNumber, side),
      });
    } catch (err) {
      socket.emit('error', { message: (err as Error).message ?? 'Vote failed' });
    }
  });

  // ── Execute the selected move ──────────────────────────────────────────────
  socket.on('consultation:execute', async (payload: ExecuteMovePayload) => {
    try {
      const result = await consultationService.executeMove(
        payload.gameId,
        socket.userId,
        payload.suggestionId,
        (event, data) => {
          if (event === 'move') {
            io.to(`consultation:${payload.gameId}`).emit('consultation:move_made', {
              gameId: payload.gameId,
              move:  data.move,
              fen:   data.fen,
              white_time_ms: data.white_time_ms,
              black_time_ms: data.black_time_ms,
              turn:  data.turn,
            });
          } else {
            io.to(`consultation:${payload.gameId}`).emit('consultation:gameover', {
              gameId: payload.gameId,
              ...data.gameOver,
            });
            consultationService.stopClock(payload.gameId);
          }
        },
      );

      if (!result.success) {
        socket.emit('error', { message: result.error ?? 'Move execution failed' });
      }
    } catch (err) {
      logger.error('consultation:execute error', { err });
      socket.emit('error', { message: 'Execute failed' });
    }
  });

  // ── Team chat ──────────────────────────────────────────────────────────────
  socket.on('consultation:chat', (payload: ConsultationChatPayload) => {
    // Broadcast only to members of the same side
    io.to(`consultation:${payload.gameId}`).emit('consultation:chat_msg', {
      gameId:    payload.gameId,
      side:      payload.side,
      senderId:  socket.userId,
      message:   sanitizeMessage(payload.message),
      timestamp: Date.now(),
    });
  });

  // ── Resign ─────────────────────────────────────────────────────────────────
  socket.on('consultation:resign', async (payload: { gameId: string }) => {
    try {
      const result = await consultationService.resign(payload.gameId, socket.userId);
      io.to(`consultation:${payload.gameId}`).emit('consultation:gameover', {
        gameId: payload.gameId,
        ...result,
      });
    } catch (err) {
      socket.emit('error', { message: (err as Error).message ?? 'Resign failed' });
    }
  });
}

function sanitizeMessage(msg: string): string {
  // Strip angle brackets to prevent XSS via chat
  return String(msg).replace(/[<>]/g, '').slice(0, 500);
}
