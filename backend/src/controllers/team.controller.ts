import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { teamService } from '../services/team.service';

// ── Validators ─────────────────────────────────────────────────────────────

export const createTeamValidators = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters'),
  body('description').optional().isString().isLength({ max: 500 }),
  body('logo_url').optional().isURL().withMessage('logo_url must be a valid URL'),
];

export const updateTeamValidators = [
  param('id').isUUID(),
  body('name').optional().trim().isLength({ min: 2, max: 80 }),
  body('description').optional().isString().isLength({ max: 500 }),
  body('logo_url').optional({ nullable: true }).isURL(),
];

// ── Handlers ───────────────────────────────────────────────────────────────

export async function createTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ errors: errors.array() }); return; }
  try {
    const team = await teamService.createTeam(
      req.user!.userId,
      req.body.name as string,
      req.body.description as string | undefined,
      req.body.logo_url as string | undefined,
    );
    res.status(201).json({ team });
  } catch (err) { next(err); }
}

export async function listTeams(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query['q'] as string | undefined;
    const limit  = Math.min(parseInt((req.query['limit']  as string) ?? '20', 10), 100);
    const offset = parseInt((req.query['offset'] as string) ?? '0', 10);
    const result = await teamService.listTeams(q, limit, offset);
    res.json(result);
  } catch (err) { next(err); }
}

export async function getTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const team = await teamService.getTeam(req.params['id']!);
    const members = await teamService.getMembers(req.params['id']!);
    res.json({ team, members });
  } catch (err) { next(err); }
}

export async function updateTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ errors: errors.array() }); return; }
  try {
    const team = await teamService.updateTeam(req.params['id']!, req.user!.userId, {
      name:        req.body.name,
      description: req.body.description,
      logoUrl:     req.body.logo_url,
    });
    res.json({ team });
  } catch (err) { next(err); }
}

export async function deleteTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await teamService.deleteTeam(req.params['id']!, req.user!.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function getMyTeams(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teams = await teamService.getUserTeams(req.user!.userId);
    res.json({ teams });
  } catch (err) { next(err); }
}

// ── Members ────────────────────────────────────────────────────────────────

export async function inviteMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(422).json({ errors: errors.array() }); return; }
  try {
    await teamService.inviteMember(
      req.params['id']!,
      req.user!.userId,
      req.body.user_id as string,
      req.body.role ?? 'player',
    );
    res.status(201).json({ message: 'Member added' });
  } catch (err) { next(err); }
}

export async function removeMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await teamService.removeMember(req.params['id']!, req.user!.userId, req.params['userId']!);
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function setMemberRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await teamService.setMemberRole(
      req.params['id']!,
      req.user!.userId,
      req.params['userId']!,
      req.body.role,
    );
    res.json({ message: 'Role updated' });
  } catch (err) { next(err); }
}

// ── Invites ────────────────────────────────────────────────────────────────

export async function createInviteLink(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const invite = await teamService.createInviteLink(
      req.params['id']!,
      req.user!.userId,
      req.body.max_uses ? Number(req.body.max_uses) : undefined,
    );
    res.status(201).json({ invite });
  } catch (err) { next(err); }
}

export async function joinByInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const team = await teamService.joinByInviteToken(
      req.params['token']!,
      req.user!.userId,
    );
    res.json({ team });
  } catch (err) { next(err); }
}

export async function getTeamInvites(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const invites = await teamService.getTeamInvites(req.params['id']!, req.user!.userId);
    res.json({ invites });
  } catch (err) { next(err); }
}

export async function revokeInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await teamService.revokeInvite(req.params['id']!, req.params['inviteId']!, req.user!.userId);
    res.status(204).send();
  } catch (err) { next(err); }
}
