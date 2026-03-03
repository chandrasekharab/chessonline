import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  tutorialMove,
  moveValidators,
  tutorialHint,
  hintValidators,
  tutorialEngineFirst,
  firstMoveValidators,
} from '../controllers/tutorial.controller';

const router = Router();

router.use(requireAuth);

router.post('/move', moveValidators, tutorialMove);
router.post('/hint', hintValidators, tutorialHint);
router.post('/engine-first-move', firstMoveValidators, tutorialEngineFirst);

export default router;
