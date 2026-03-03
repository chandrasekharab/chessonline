import 'dotenv/config';
import { createServer } from 'http';
import app from './app';
import { env } from './config/env';
import { checkDatabaseConnection } from './config/database';
import { redisConnection } from './config/redis';
import { createSocketServer } from './socket';
import { logger } from './utils/logger';

async function start(): Promise<void> {
  // Verify connectivity before accepting traffic
  await checkDatabaseConnection();
  await redisConnection.connect();

  const httpServer = createServer(app);
  const io = createSocketServer(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`Chess Insight Engine API running on port ${env.PORT}`, {
      env: env.NODE_ENV,
    });
    logger.info('Socket.IO server attached');
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received – shutting down gracefully`);
    io.close();
    httpServer.close(async () => {
      await redisConnection.quit();
      logger.info('Server closed');
      process.exit(0);
    });

    // Force shutdown after 10 s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason });
  });
}

start().catch((err) => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});
