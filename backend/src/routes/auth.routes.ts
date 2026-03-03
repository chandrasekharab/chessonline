import { Router } from 'express';
import {
  register,
  login,
  me,
  registerValidators,
  loginValidators,
} from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', registerValidators, register);
router.post('/login', loginValidators, login);
router.get('/me', requireAuth, me);

export default router;
