import { io, Socket } from 'socket.io-client';

// Connect via same origin so nginx proxies the WebSocket — works in both dev and Docker
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8001');

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    throw new Error('Socket not initialized. Call connectSocket() first.');
  }
  return socket;
}

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error', err.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}
