/**
 * Explanation Controller
 *
 * Endpoints:
 *   POST /explanations/games/:gameId/moves/:moveNumber   → explain single move
 *   GET  /explanations/games/:gameId/summary             → get/generate game summary
 *   GET  /explanations/games/:gameId/all                 → all cached explanations for game
 *   GET  /explanations/me/patterns                       → user's mistake patterns
 *   GET  /explanations/me/token-usage                    → user's LLM token usage stats
 */

import { Request, Response, NextFunction } from 'express';
import { param, body, validationResult } from 'express-validator';
import { explainMove, getOrGenerateGameSummary } from '../services/aiExplanation.orchestrator';
import { generatePuzzleExplanation, chatWithCoach, ChatTurn, ChatContext } from '../services/explanation.service';
import { explanationRepo } from '../repositories/explanation.repository';
import { getRatingTier } from '../types';
import { logger } from '../utils/logger';

export const explainMoveValidators = [
  param('gameId').isUUID(),
  param('moveNumber').isInt({ min: 1 }),
];

export const gameSummaryValidators = [
  param('gameId').isUUID(),
];

/** POST /explanations/games/:gameId/moves/:moveNumber */
export async function explainMoveHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }

  try {
    const userId = req.user!.userId;
    const gameId = req.params['gameId']!;
    const moveNumber = parseInt(req.params['moveNumber']!, 10);

    const result = await explainMove({ gameId, moveNumber, userId });
    res.json(result);
  } catch (err) {
    logger.error('explainMove error', { error: String(err) });
    next(err);
  }
}

/** GET /explanations/games/:gameId/summary */
export async function getGameSummaryHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }

  try {
    const userId = req.user!.userId;
    const gameId = req.params['gameId']!;

    const result = await getOrGenerateGameSummary({ gameId, userId });
    res.json(result);
  } catch (err) {
    logger.error('getGameSummary error', { error: String(err) });
    next(err);
  }
}

/** POST /explanations/puzzle/explain */
export const explainPuzzleValidators = [
  body('fen').isString().notEmpty(),
  body('solution').isArray({ min: 1 }),
  body('tags').isArray(),
  body('rating').optional().isInt({ min: 0, max: 3500 }),
];

export async function explainPuzzleHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }

  try {
    const { fen, solution, tags, rating } = req.body as {
      fen: string;
      solution: string[];
      tags: string[];
      rating?: number;
    };
    const ratingTier = getRatingTier(rating ?? 800);
    const result = await generatePuzzleExplanation(fen, solution, tags, ratingTier);
    res.json(result);
  } catch (err) {
    logger.error('explainPuzzle error', { error: String(err) });
    next(err);
  }
}

/** GET /explanations/games/:gameId/all */
export async function getAllExplanationsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const gameId = req.params['gameId']!;
    const explanations = await explanationRepo.getExplanationsByGame(gameId);
    res.json({ explanations });
  } catch (err) {
    next(err);
  }
}

/** GET /explanations/me/patterns */
export async function getMistakePatternsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const patterns = await explanationRepo.getMistakePatterns(userId);
    res.json({ patterns });
  } catch (err) {
    next(err);
  }
}

/** POST /explanations/games/:gameId/chat */
export const chatCoachValidators = [
  param('gameId').isUUID(),
  body('message').isString().notEmpty().isLength({ max: 500 }),
  body('history').optional().isArray({ max: 20 }),
  body('context').optional().isObject(),
];

export async function chatCoachHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }

  try {
    const { message, history = [], context = {} } = req.body as {
      message: string;
      history?: ChatTurn[];
      context?: ChatContext;
    };
    const result = await chatWithCoach(context, history, message);
    res.json(result);
  } catch (err) {
    logger.error('chatCoach error', { error: String(err) });
    next(err);
  }
}

/** GET /explanations/me/token-usage */
export async function getTokenUsageHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const stats = await explanationRepo.getUserTokenStats(userId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
}
