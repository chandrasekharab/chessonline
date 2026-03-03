import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { gamesService } from '../services/games.service';
import { env } from '../config/env';

export const createGameValidators = [
  body('pgn').notEmpty().withMessage('PGN is required'),
];

export const analyseValidators = [
  body('depth').optional().isInt({ min: 1, max: 30 }),
  param('id').isUUID(),
];

export async function createGame(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }

  try {
    const userId = req.user!.userId;
    const pgn = req.body.pgn as string;
    const game = await gamesService.createGame(userId, pgn);
    res.status(201).json({ game });
  } catch (err) {
    next(err);
  }
}

export async function listGames(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const limit = parseInt((req.query['limit'] as string) ?? '20', 10);
    const offset = parseInt((req.query['offset'] as string) ?? '0', 10);
    const result = await gamesService.listGames(userId, Math.min(limit, 100), offset);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getGame(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const game = await gamesService.getGame(req.params['id']!, req.user!.userId);
    res.json({ game });
  } catch (err) {
    next(err);
  }
}

export async function triggerAnalysis(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ errors: errors.array() });
    return;
  }

  try {
    const depth = req.body.depth as number | undefined;
    await gamesService.triggerAnalysis(req.params['id']!, req.user!.userId, depth);
    res.status(202).json({ message: 'Analysis queued' });
  } catch (err) {
    next(err);
  }
}

export async function getAnalysis(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await gamesService.getAnalysis(req.params['id']!, req.user!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteGame(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await gamesService.deleteGame(req.params['id']!, req.user!.userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function uploadGame(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const pgn = req.file.buffer.toString('utf-8');
    const userId = req.user!.userId;
    const game = await gamesService.createGame(userId, pgn);
    res.status(201).json({ game });
  } catch (err) {
    next(err);
  }
}
