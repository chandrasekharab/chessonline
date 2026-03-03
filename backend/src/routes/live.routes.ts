import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { liveGameRepository } from '../repositories/liveGame.repository';

const router = Router();

// GET /live/history — completed live games for current user
router.get('/history', requireAuth, async (req: Request, res: Response) => {
  try {
    const games = await liveGameRepository.findCompletedByUser(req.user!.userId, 20);
    res.json(games);
  } catch {
    res.status(500).json({ error: 'Failed to fetch game history' });
  }
});

// GET /live/:id — single live game detail
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const game = await liveGameRepository.findByIdWithUsers(req.params['id']);
    if (!game) return res.status(404).json({ error: 'Game not found' });

    // Only players can view game details (relax to public for spectating later)
    if (game.white_user_id !== req.user!.userId && game.black_user_id !== req.user!.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(game);
  } catch {
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// GET /live/:id/active — get active game for current user (reconnect)
router.get('/active/mine', requireAuth, async (req: Request, res: Response) => {
  try {
    const game = await liveGameRepository.findActiveByUser(req.user!.userId);
    res.json(game ?? null);
  } catch {
    res.status(500).json({ error: 'Failed to fetch active game' });
  }
});

export default router;
