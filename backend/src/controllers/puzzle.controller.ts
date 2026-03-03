import { Request, Response, NextFunction } from 'express';
import { param, body, query, validationResult } from 'express-validator';
import {
  getNextPuzzle,
  checkMove,
  resignPuzzle,
  getUserStats,
} from '../services/puzzle.service';

// ── GET /puzzles/next ──────────────────────────────────────────────────────
export const nextPuzzleValidators = [
  query('theme').optional().isString(),
  query('difficulty').optional().isInt({ min: 1, max: 5 }),
];

export async function nextPuzzle(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

  const userId     = req.user!.userId;
  const theme      = req.query['theme'] as string | undefined;
  const difficulty = req.query['difficulty']
    ? parseInt(req.query['difficulty'] as string, 10)
    : undefined;

  try {
    const puzzle = await getNextPuzzle(userId, theme, difficulty);
    if (!puzzle) { res.status(404).json({ error: 'No puzzles available' }); return; }
    res.json({ puzzle });
  } catch (err) { next(err); }
}

// ── POST /puzzles/:id/move ─────────────────────────────────────────────────
export const checkMoveValidators = [
  param('id').isUUID(),
  body('moveUci').isString().notEmpty(),
  body('currentFen').isString().notEmpty(),
  body('solutionIndex').isInt({ min: 0 }),
];

export async function checkPuzzleMove(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

  const userId    = req.user!.userId;
  const puzzleId  = req.params['id']!;
  const { moveUci, currentFen, solutionIndex } = req.body as {
    moveUci: string;
    currentFen: string;
    solutionIndex: number;
  };

  try {
    const result = await checkMove(puzzleId, userId, moveUci, currentFen, solutionIndex);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'Puzzle not found') { res.status(404).json({ error: msg }); return; }
    if (msg === 'Invalid solution index') { res.status(400).json({ error: msg }); return; }
    next(err);
  }
}

// ── POST /puzzles/:id/resign ───────────────────────────────────────────────
export const resignValidators = [param('id').isUUID()];

export async function resignPuzzleHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

  const userId   = req.user!.userId;
  const puzzleId = req.params['id']!;

  try {
    const result = await resignPuzzle(puzzleId, userId);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'Puzzle not found') { res.status(404).json({ error: msg }); return; }
    next(err);
  }
}

// ── GET /puzzles/stats ─────────────────────────────────────────────────────
export async function puzzleStats(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.user!.userId;
  try {
    const stats = await getUserStats(userId);
    res.json(stats);
  } catch (err) { next(err); }
}
