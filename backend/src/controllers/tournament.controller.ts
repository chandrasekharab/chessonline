import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { tournamentService } from '../services/tournament.service';

export const createTournamentValidators = [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('format').isIn(['swiss', 'round_robin', 'knockout']),
  body('team_size').optional().isInt({ min: 1, max: 10 }),
  body('time_control').optional().isIn(['bullet', 'blitz', 'rapid']),
  body('max_teams').optional().isInt({ min: 2 }),
  body('rounds_total').optional().isInt({ min: 1, max: 20 }),
];

export async function createTournament(req: Request, res: Response, next: NextFunction): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ errors: errors.array() }); return; }
  try {
    const tournament = await tournamentService.createTournament(req.user!.userId, {
      name: req.body.name,
      description: req.body.description,
      leagueId: req.body.league_id,
      format: req.body.format,
      teamSize: req.body.team_size,
      timeControl: req.body.time_control,
      maxTeams: req.body.max_teams,
      roundsTotal: req.body.rounds_total,
      startDate: req.body.start_date ? new Date(req.body.start_date as string) : undefined,
    });
    res.status(201).json({ tournament });
  } catch (err) { next(err); }
}

export async function listTournaments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await tournamentService.listTournaments({
      status:   req.query['status'] as string | undefined,
      leagueId: req.query['league_id'] as string | undefined,
      limit:    parseInt((req.query['limit'] as string) ?? '20', 10),
      offset:   parseInt((req.query['offset'] as string) ?? '0', 10),
    });
    res.json(result);
  } catch (err) { next(err); }
}

export async function getTournament(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [tournament, standings, rounds] = await Promise.all([
      tournamentService.getTournament(req.params['id']!),
      tournamentService.getStandings(req.params['id']!),
      tournamentService.getRounds(req.params['id']!),
    ]);
    res.json({ tournament, standings, rounds });
  } catch (err) { next(err); }
}

export async function registerTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entry = await tournamentService.registerTeam(
      req.params['id']!,
      req.body.team_id as string,
      req.user!.userId,
    );
    res.status(201).json({ entry });
  } catch (err) { next(err); }
}

export async function startTournament(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const round = await tournamentService.startTournament(req.params['id']!, req.user!.userId);
    res.json({ round });
  } catch (err) { next(err); }
}

export async function getRoundMatches(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const matches = await tournamentService.getMatchesForRound(req.params['roundId']!);
    res.json({ matches });
  } catch (err) { next(err); }
}

export async function getMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [match, boards] = await Promise.all([
      tournamentService.getMatch(req.params['matchId']!),
      tournamentService.getBoardsForMatch(req.params['matchId']!),
    ]);
    if (!match) { res.status(404).json({ error: 'Match not found' }); return; }
    res.json({ match, boards });
  } catch (err) { next(err); }
}

export async function submitBoardResult(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { result, live_game_id } = req.body as { result: 'white' | 'black' | 'draw'; live_game_id?: string };
    await tournamentService.submitBoardResult(
      req.params['matchId']!,
      req.params['boardId']!,
      result,
      req.user!.userId,
      live_game_id,
    );
    res.json({ message: 'Board result recorded' });
  } catch (err) { next(err); }
}
