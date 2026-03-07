import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { leagueService } from '../services/league.service';

export const createLeagueValidators = [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('visibility').isIn(['public', 'private']),
  body('description').optional().isString().isLength({ max: 1000 }),
];

export async function createLeague(req: Request, res: Response, next: NextFunction): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ errors: errors.array() }); return; }
  try {
    const league = await leagueService.createLeague(req.user!.userId, {
      name:        req.body.name,
      description: req.body.description,
      visibility:  req.body.visibility,
      season:      req.body.season ? Number(req.body.season) : undefined,
      startDate:   req.body.start_date ? new Date(req.body.start_date as string) : undefined,
      endDate:     req.body.end_date   ? new Date(req.body.end_date   as string) : undefined,
    });
    res.status(201).json({ league });
  } catch (err) { next(err); }
}

export async function listLeagues(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await leagueService.listLeagues({
      visibility: (req.query['visibility'] as 'public' | 'private') ?? 'public',
      limit:  parseInt((req.query['limit']  as string) ?? '20', 10),
      offset: parseInt((req.query['offset'] as string) ?? '0',  10),
    });
    res.json(result);
  } catch (err) { next(err); }
}

export async function getLeague(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [league, teams, announcements, tournaments] = await Promise.all([
      leagueService.getLeague(req.params['id']!),
      leagueService.getLeagueTeams(req.params['id']!),
      leagueService.getAnnouncements(req.params['id']!),
      leagueService.getLeagueTournaments(req.params['id']!),
    ]);
    res.json({ league, teams, announcements, tournaments });
  } catch (err) { next(err); }
}

export async function updateLeague(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const league = await leagueService.updateLeague(req.params['id']!, req.user!.userId, req.body);
    res.json({ league });
  } catch (err) { next(err); }
}

export async function joinLeague(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entry = await leagueService.joinLeague(
      req.params['id']!,
      req.body.team_id as string,
      req.user!.userId,
      req.body.invite_code as string | undefined,
    );
    res.status(201).json({ entry });
  } catch (err) { next(err); }
}

export async function joinLeagueByCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const league = await leagueService.joinByInviteCode(
      req.params['code']!,
      req.body.team_id as string,
      req.user!.userId,
    );
    res.json({ league });
  } catch (err) { next(err); }
}

export async function approveTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await leagueService.approveTeam(req.params['id']!, req.params['teamId']!, req.user!.userId);
    res.json({ message: 'Team approved' });
  } catch (err) { next(err); }
}

export async function removeTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await leagueService.removeTeam(req.params['id']!, req.params['teamId']!, req.user!.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function postAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const announcement = await leagueService.postAnnouncement(
      req.params['id']!, req.user!.userId, req.body.body as string,
    );
    res.status(201).json({ announcement });
  } catch (err) { next(err); }
}

export async function getStandings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const standings = await leagueService.getStandings(req.params['id']!);
    res.json({ standings });
  } catch (err) { next(err); }
}
