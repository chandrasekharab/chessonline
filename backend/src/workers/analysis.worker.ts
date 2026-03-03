import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';
import { ANALYSIS_QUEUE_NAME } from '../queue/analysisQueue';
import { analyseGame } from '../services/analysis.service';
import { engineService } from '../services/engine.service';
import { GameRepository } from '../repositories/game.repository';
import { AnalysisJobData } from '../types';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const gameRepo = new GameRepository();

async function processJob(job: Job<AnalysisJobData>): Promise<void> {
  const { gameId, depth } = job.data;
  logger.info('Worker picked up analysis job', { jobId: job.id, gameId });

  try {
    await analyseGame(gameId, depth ?? env.ENGINE_DEPTH);
    logger.info('Worker completed analysis job', { jobId: job.id, gameId });
  } catch (err) {
    logger.error('Worker failed analysis job', { jobId: job.id, gameId, error: String(err) });
    await gameRepo.updateStatus(gameId, 'failed');
    throw err;
  }
}

async function start(): Promise<void> {
  // Initialise Stockfish pool before processing jobs
  await engineService.init();

  const worker = new Worker<AnalysisJobData>(
    ANALYSIS_QUEUE_NAME,
    processJob,
    {
      connection: redisConnectionOptions,
      concurrency: env.ENGINE_MAX_CONCURRENT,
    }
  );

  worker.on('completed', (job) =>
    logger.info('Job completed', { jobId: job.id })
  );

  worker.on('failed', (job, err) =>
    logger.error('Job failed', { jobId: job?.id, error: err.message })
  );

  worker.on('stalled', (jobId) =>
    logger.warn('Job stalled', { jobId })
  );

  logger.info('Analysis worker started', { concurrency: env.ENGINE_MAX_CONCURRENT });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down worker...');
    await worker.close();
    engineService.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  logger.error('Worker failed to start', { error: err.message });
  process.exit(1);
});
