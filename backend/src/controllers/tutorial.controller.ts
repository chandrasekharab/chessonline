import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import {
  processPlayerMove,
  getHint,
  engineFirstMove,
} from '../services/tutorial.service';

// ── Validators ─────────────────────────────────────────────────────────────
export const moveValidators = [
  body('fen').isString().notEmpty().withMessage('fen is required'),
  body('move').isString().notEmpty().withMessage('move (UCI) is required'),
  body('playerColor')
    .isIn(['white', 'black'])
    .withMessage('playerColor must be white or black'),
  body('difficulty')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('difficulty must be 1–5'),
];

export const hintValidators = [
  body('fen').isString().notEmpty().withMessage('fen is required'),
  body('playerColor')
    .isIn(['white', 'black'])
    .withMessage('playerColor must be white or black'),
  body('difficulty')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('difficulty must be 1–5'),
];

export const firstMoveValidators = [
  body('fen').optional().isString(),
  body('difficulty')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('difficulty must be 1–5'),
];

// ── POST /tutorial/move ────────────────────────────────────────────────────
export async function tutorialMove(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { fen, move, playerColor, difficulty = 3 } = req.body as {
    fen: string;
    move: string;
    playerColor: 'white' | 'black';
    difficulty?: number;
  };

  try {
    const result = await processPlayerMove(fen, move, playerColor, difficulty);
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg === 'Invalid move') {
      res.status(400).json({ error: 'Invalid move' });
      return;
    }
    next(err);
  }
}

// ── POST /tutorial/hint ────────────────────────────────────────────────────
export async function tutorialHint(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { fen, playerColor, difficulty = 3 } = req.body as {
    fen: string;
    playerColor: 'white' | 'black';
    difficulty?: number;
  };

  try {
    const result = await getHint(fen, playerColor, difficulty);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ── POST /tutorial/engine-first-move ──────────────────────────────────────
export async function tutorialEngineFirst(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const { fen = START_FEN, difficulty = 3 } = req.body as {
    fen?: string;
    difficulty?: number;
  };

  try {
    const result = await engineFirstMove(fen, difficulty);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
