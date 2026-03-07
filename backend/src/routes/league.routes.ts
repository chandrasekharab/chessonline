import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  createLeagueValidators,
  createLeague, listLeagues, getLeague, updateLeague,
  joinLeague, joinLeagueByCode, approveTeam, removeTeam,
  postAnnouncement, getStandings,
} from '../controllers/league.controller';

const router = Router();
router.use(requireAuth);

router.get('/',   listLeagues);
router.post('/', createLeagueValidators, createLeague);
router.get('/:id',       getLeague);
router.patch('/:id',     updateLeague);

router.get('/:id/standings',                             getStandings);
router.post('/:id/join',                                 joinLeague);
router.post('/join/:code',                               joinLeagueByCode);
router.post('/:id/teams/:teamId/approve',                approveTeam);
router.delete('/:id/teams/:teamId',                      removeTeam);
router.post('/:id/announcements',                        postAnnouncement);

export default router;
