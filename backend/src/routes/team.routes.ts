import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  createTeamValidators, updateTeamValidators,
  createTeam, listTeams, getTeam, updateTeam, deleteTeam, getMyTeams,
  inviteMember, removeMember, setMemberRole,
  createInviteLink, joinByInvite, getTeamInvites, revokeInvite,
} from '../controllers/team.controller';

const router = Router();
router.use(requireAuth);

// CRUD
router.get('/me',     getMyTeams);
router.get('/',       listTeams);
router.post('/', createTeamValidators, createTeam);
router.get('/:id',    getTeam);
router.patch('/:id', updateTeamValidators, updateTeam);
router.delete('/:id', deleteTeam);

// Members
router.post('/:id/members',               inviteMember);
router.delete('/:id/members/:userId',     removeMember);
router.patch('/:id/members/:userId/role', setMemberRole);

// Invites
router.get('/:id/invites',              getTeamInvites);
router.post('/:id/invites',             createInviteLink);
router.delete('/:id/invites/:inviteId', revokeInvite);
router.post('/join/:token',             joinByInvite);

export default router;
