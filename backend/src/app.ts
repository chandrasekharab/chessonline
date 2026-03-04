import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { globalRateLimit } from './middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import authRoutes from './routes/auth.routes';
import gamesRoutes from './routes/games.routes';
import liveRoutes from './routes/live.routes';
import tutorialRoutes from './routes/tutorial.routes';
import puzzleRoutes from './routes/puzzle.routes';
import explanationRoutes from './routes/explanation.routes';
import { env } from './config/env';

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors({
  origin: env.NODE_ENV === 'production'
    ? process.env['CORS_ORIGIN'] ?? 'http://localhost:8001'
    : '*',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Rate limiting
app.use(globalRateLimit);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', env: env.NODE_ENV }));

// API routes
app.use('/auth', authRoutes);
app.use('/games', gamesRoutes);
app.use('/live', liveRoutes);
app.use('/tutorial', tutorialRoutes);
app.use('/puzzles', puzzleRoutes);
app.use('/explanations', explanationRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
