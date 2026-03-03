import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { analysisRateLimit } from '../middleware/rateLimit.middleware';
import {
  createGame,
  createGameValidators,
  listGames,
  getGame,
  triggerAnalysis,
  analyseValidators,
  getAnalysis,
  deleteGame,
  uploadGame,
} from '../controllers/games.controller';
import { env } from '../config/env';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/octet-stream' || file.originalname.endsWith('.pgn')) {
      cb(null, true);
    } else {
      cb(new Error('Only .pgn files are allowed'));
    }
  },
});

// All routes require auth
router.use(requireAuth);

router.get('/', listGames);
router.post('/', createGameValidators, createGame);
router.post('/upload', upload.single('pgn'), uploadGame);
router.get('/:id', getGame);
router.delete('/:id', deleteGame);
router.post('/:id/analyze', analysisRateLimit, analyseValidators, triggerAnalysis);
router.get('/:id/analysis', getAnalysis);

export default router;
