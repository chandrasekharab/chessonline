import { Server as HTTPServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { env } from '../config/env';
import { authService } from '../services/auth.service';
import { logger } from '../utils/logger';
import { registerGameHandlers } from './gameHandlers';
import { registerConsultationHandlers } from './consultationHandlers';

// Map socketId → userId for quick lookups
export const socketUserMap = new Map<string, string>();
// Map userId → socketId (latest active socket)
export const userSocketMap = new Map<string, string>();

export function createSocketServer(httpServer: HTTPServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin:
        env.NODE_ENV === 'production'
          ? (process.env['CORS_ORIGIN'] ?? 'http://localhost:8001')
          : '*',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ── Authentication middleware ───────────────────────────────────────────────
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token as string | undefined ??
      (socket.handshake.headers.authorization as string | undefined)?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = authService.verifyToken(token);
      (socket as SocketWithUser).userId = payload.userId;
      (socket as SocketWithUser).email = payload.email;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const s = socket as SocketWithUser;
    logger.info('Socket connected', { socketId: s.id, userId: s.userId });

    socketUserMap.set(s.id, s.userId);
    userSocketMap.set(s.userId, s.id);

    registerGameHandlers(io, s);
    registerConsultationHandlers(io, s);

    s.on('disconnect', () => {
      logger.info('Socket disconnected', { socketId: s.id, userId: s.userId });
      socketUserMap.delete(s.id);
      userSocketMap.delete(s.userId);
    });
  });

  return io;
}

export interface SocketWithUser extends Socket {
  userId: string;
  email: string;
}
