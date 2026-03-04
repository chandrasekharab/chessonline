import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  explainMoveHandler,
  explainMoveValidators,
  getGameSummaryHandler,
  gameSummaryValidators,
  getAllExplanationsHandler,
  getMistakePatternsHandler,
  getTokenUsageHandler,
  explainPuzzleHandler,
  explainPuzzleValidators,
  chatCoachHandler,
  chatCoachValidators,
} from '../controllers/explanation.controller';

const router = Router();

// All explanation routes require auth
router.use(requireAuth);

/** Explain a specific move on demand */
router.post(
  '/games/:gameId/moves/:moveNumber',
  explainMoveValidators,
  explainMoveHandler,
);

/** Get or generate AI post-game summary */
router.get(
  '/games/:gameId/summary',
  gameSummaryValidators,
  getGameSummaryHandler,
);

/** Get all cached explanations for a game */
router.get(
  '/games/:gameId/all',
  getAllExplanationsHandler,
);

/** Get user's accumulated mistake patterns */
router.get('/me/patterns', getMistakePatternsHandler);

/** Get user's LLM token usage */
router.get('/me/token-usage', getTokenUsageHandler);

/** Explain a puzzle solution */
router.post('/puzzle/explain', explainPuzzleValidators, explainPuzzleHandler);

/** Free-form AI coach chat for a game */
router.post('/games/:gameId/chat', chatCoachValidators, chatCoachHandler);

export default router;
