import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  nextPuzzle,
  nextPuzzleValidators,
  checkPuzzleMove,
  checkMoveValidators,
  resignPuzzleHandler,
  resignValidators,
  puzzleStats,
} from '../controllers/puzzle.controller';

const router = Router();

router.use(requireAuth);

router.get('/next',       nextPuzzleValidators, nextPuzzle);
router.get('/stats',      puzzleStats);
router.post('/:id/move',  checkMoveValidators,  checkPuzzleMove);
router.post('/:id/resign', resignValidators,     resignPuzzleHandler);

export default router;
