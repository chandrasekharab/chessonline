import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  createTournamentValidators,
  createTournament, listTournaments, getTournament,
  registerTeam, startTournament,
  getRoundMatches, getMatch, submitBoardResult,
} from '../controllers/tournament.controller';

const router = Router();
router.use(requireAuth);

router.get('/',   listTournaments);
router.post('/', createTournamentValidators, createTournament);
router.get('/:id',         getTournament);
router.post('/:id/register', registerTeam);
router.post('/:id/start',    startTournament);
router.get('/rounds/:roundId/matches', getRoundMatches);
router.get('/matches/:matchId',        getMatch);
router.post('/matches/:matchId/boards/:boardId/result', submitBoardResult);

export default router;
