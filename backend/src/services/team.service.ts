import { teamRepository } from '../repositories/team.repository';
import { userRepository } from '../repositories/user.repository';
import { Team, TeamMember, TeamInvite, TeamRole } from '../types';
import { logger } from '../utils/logger';

class TeamService {
  async createTeam(captainId: string, name: string, description?: string, logoUrl?: string): Promise<Team> {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      throw Object.assign(new Error('Team name must be 2–80 characters'), { status: 400 });
    }

    const existing = await teamRepository.findByName(trimmed);
    if (existing) throw Object.assign(new Error('Team name already taken'), { status: 409 });

    const team = await teamRepository.create({
      name: trimmed,
      captainId,
      description,
      logoUrl,
    });

    // Captain is automatically a member
    await teamRepository.addMember(team.id, captainId, 'captain');

    logger.info('Team created', { teamId: team.id, captainId });
    return team;
  }

  async getTeam(teamId: string): Promise<Team> {
    const team = await teamRepository.findById(teamId);
    if (!team) throw Object.assign(new Error('Team not found'), { status: 404 });
    return team;
  }

  async updateTeam(teamId: string, requesterId: string, params: {
    name?: string;
    description?: string | null;
    logoUrl?: string | null;
  }): Promise<Team> {
    await this.requireRole(teamId, requesterId, ['captain']);
    const team = await teamRepository.update(teamId, params);
    if (!team) throw Object.assign(new Error('Team not found'), { status: 404 });
    return team;
  }

  async deleteTeam(teamId: string, requesterId: string): Promise<void> {
    await this.requireRole(teamId, requesterId, ['captain']);
    await teamRepository.delete(teamId);
  }

  async listTeams(q?: string, limit = 20, offset = 0): Promise<{ teams: Team[]; total: number }> {
    if (q?.trim()) return { teams: await teamRepository.search(q.trim(), limit), total: -1 };
    return teamRepository.list(limit, offset);
  }

  async getMembers(teamId: string): Promise<TeamMember[]> {
    await this.getTeam(teamId); // existence check
    return teamRepository.getMembers(teamId);
  }

  async inviteMember(teamId: string, requesterId: string, targetUserId: string, role: TeamRole = 'player'): Promise<void> {
    await this.requireRole(teamId, requesterId, ['captain', 'coach']);
    const user = await userRepository.findById(targetUserId);
    if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
    await teamRepository.addMember(teamId, targetUserId, role);
  }

  async removeMember(teamId: string, requesterId: string, targetUserId: string): Promise<void> {
    const requesterMember = await teamRepository.getMember(teamId, requesterId);
    if (!requesterMember) throw Object.assign(new Error('Not a team member'), { status: 403 });

    // Captains can remove anyone; players can only remove themselves
    if (requesterMember.role !== 'captain' && requesterId !== targetUserId) {
      throw Object.assign(new Error('Insufficient permissions'), { status: 403 });
    }

    const team = await this.getTeam(teamId);
    if (team.captain_id === targetUserId) {
      throw Object.assign(new Error('Cannot remove the team captain'), { status: 400 });
    }

    await teamRepository.removeMember(teamId, targetUserId);
  }

  async setMemberRole(teamId: string, requesterId: string, targetUserId: string, role: TeamRole): Promise<void> {
    await this.requireRole(teamId, requesterId, ['captain']);
    const member = await teamRepository.getMember(teamId, targetUserId);
    if (!member) throw Object.assign(new Error('User is not a team member'), { status: 404 });
    await teamRepository.updateMemberRole(teamId, targetUserId, role);
  }

  async getUserTeams(userId: string): Promise<(Team & { role: TeamRole })[]> {
    return teamRepository.getUserTeams(userId);
  }

  // ── Invite links ───────────────────────────────────────────────────────────

  async createInviteLink(teamId: string, requesterId: string, maxUses?: number): Promise<TeamInvite> {
    await this.requireRole(teamId, requesterId, ['captain', 'coach']);
    return teamRepository.createInvite(teamId, requesterId, maxUses);
  }

  async joinByInviteToken(token: string, userId: string): Promise<Team> {
    const invite = await teamRepository.findInviteByToken(token);
    if (!invite) throw Object.assign(new Error('Invalid or expired invite link'), { status: 404 });

    const already = await teamRepository.getMember(invite.team_id, userId);
    if (!already) {
      await teamRepository.addMember(invite.team_id, userId, 'player');
      await teamRepository.incrementInviteUse(token);
    }

    const team = await teamRepository.findById(invite.team_id);
    return team!;
  }

  async getTeamInvites(teamId: string, requesterId: string): Promise<TeamInvite[]> {
    await this.requireRole(teamId, requesterId, ['captain', 'coach']);
    return teamRepository.getTeamInvites(teamId);
  }

  async revokeInvite(teamId: string, inviteId: string, requesterId: string): Promise<void> {
    await this.requireRole(teamId, requesterId, ['captain', 'coach']);
    await teamRepository.revokeInvite(inviteId, teamId);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  async requireRole(teamId: string, userId: string, allowed: TeamRole[]): Promise<TeamMember> {
    const member = await teamRepository.getMember(teamId, userId);
    if (!member) throw Object.assign(new Error('Not a team member'), { status: 403 });
    if (!allowed.includes(member.role)) throw Object.assign(new Error('Insufficient permissions'), { status: 403 });
    return member;
  }

  async isMember(teamId: string, userId: string): Promise<boolean> {
    const m = await teamRepository.getMember(teamId, userId);
    return !!m;
  }
}

export const teamService = new TeamService();
