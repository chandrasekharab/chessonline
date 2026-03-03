import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../config/redis';
import { AnalysisJobData } from '../types';
import { logger } from '../utils/logger';

export const ANALYSIS_QUEUE_NAME = 'chess-analysis';

export const analysisQueue = new Queue<AnalysisJobData>(ANALYSIS_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export async function enqueueAnalysis(data: AnalysisJobData): Promise<void> {
  await analysisQueue.add('analyse', data, {
    jobId: `game-${data.gameId}`,
    priority: 1,
  });
  logger.info('Analysis job enqueued', { gameId: data.gameId });
}
