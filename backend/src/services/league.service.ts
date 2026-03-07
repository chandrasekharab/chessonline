import { leagueRepository } from '../repositories/league.repository';
import { teamRepository } from '../repositories/team.repository';
import { tournamentRepository } from '../repositories/tournament.repository';
import { League, LeagueTeamEntry, LeagueAnnouncement, LeagueVisibility } from '../types';

class LeagueService {
  async createLeague(organizerId: string, params: {
    name: string;
    description?: string;
    visibility: LeagueVisibility;
    season?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<League> {
    if (!params.name?.trim()) throw Object.assign(new Error('League name required'), { status: 400 });
    return leagueRepository.create({ ...params, name: params.name.trim(), organizerId });
  }

  async getLeague(id: string): Promise<League> {
    const league = await leagueRepository.findById(id);
    if (!league) throw Object.assign(new Error('League not found'), { status: 404 });
    return league;
  }

  async listLeagues(params: {
    organizerId?: string;
    visibility?: LeagueVisibility;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ leagues: League[]; total: number }> {
    return leagueRepository.list(params);
  }

  async updateLeague(leagueId: string, requesterId: string, params: {
    name?: string;
    description?: string | null;
    status?: 'active' | 'completed' | 'archived';
    endDate?: Date | null;
  }): Promise<League> {
    const league = await this.getLeague(leagueId);
    if (league.organizer_id !== requesterId) {
      throw Object.assign(new Error('Only the organizer can update the league'), { status: 403 });
    }
    const updated = await leagueRepository.update(leagueId, params);
    return updated!;
  }

  // ── Team management ────────────────────────────────────────────────────────

  async joinLeague(leagueId: string, teamId: string, userId: string, inviteCode?: string): Promise<LeagueTeamEntry> {
    const league = await this.getLeague(leagueId);

    if (league.visibility === 'private') {
      if (!inviteCode || inviteCode.toUpperCase() !== league.invite_code) {
        throw Object.assign(new Error('Invalid invite code'), { status: 403 });
      }
    }

    const member = await teamRepository.getMember(teamId, userId);
    if (!member || !['captain', 'coach'].includes(member.role)) {
      throw Object.assign(new Error('Only team captain or coach can join'), { status: 403 });
    }

    // Auto-approve for public leagues; pending for private
    const approved = league.visibility === 'public';
    return leagueRepository.addTeam(leagueId, teamId, approved);
  }

  async approveTeam(leagueId: string, teamId: string, requesterId: string): Promise<void> {
    const league = await this.getLeague(leagueId);
    if (league.organizer_id !== requesterId) {
      throw Object.assign(new Error('Only the organizer can approve teams'), { status: 403 });
    }
    await leagueRepository.approveTeam(leagueId, teamId);
  }

  async removeTeam(leagueId: string, teamId: string, requesterId: string): Promise<void> {
    const league = await this.getLeague(leagueId);
    if (league.organizer_id !== requesterId) {
      throw Object.assign(new Error('Only the organizer can remove teams'), { status: 403 });
    }
    await leagueRepository.removeTeam(leagueId, teamId);
  }

  async getLeagueTeams(leagueId: string): Promise<LeagueTeamEntry[]> {
    await this.getLeague(leagueId);
    return leagueRepository.getLeagueTeams(leagueId);
  }

  async getStandings(leagueId: string): Promise<LeagueTeamEntry[]> {
    await this.getLeague(leagueId);
    return leagueRepository.getLeagueTeams(leagueId, true);
  }

  // ── Announcements ──────────────────────────────────────────────────────────

  async postAnnouncement(leagueId: string, authorId: string, body: string): Promise<LeagueAnnouncement> {
    const league = await this.getLeague(leagueId);
    if (league.organizer_id !== authorId) {
      throw Object.assign(new Error('Only the organizer can post announcements'), { status: 403 });
    }
    if (!body?.trim()) throw Object.assign(new Error('Announcement body required'), { status: 400 });
    return leagueRepository.createAnnouncement(leagueId, authorId, body.trim());
  }

  async getAnnouncements(leagueId: string): Promise<LeagueAnnouncement[]> {
    await this.getLeague(leagueId);
    return leagueRepository.getAnnouncements(leagueId);
  }

  // ── Tournaments in a league ────────────────────────────────────────────────

  async getLeagueTournaments(leagueId: string): Promise<{ tournaments: unknown[]; total: number }> {
    await this.getLeague(leagueId);
    return tournamentRepository.list({ leagueId });
  }

  async joinByInviteCode(code: string, teamId: string, userId: string): Promise<League> {
    const league = await leagueRepository.findByInviteCode(code.toUpperCase());
    if (!league) throw Object.assign(new Error('Invalid or expired invite code'), { status: 404 });
    await this.joinLeague(league.id, teamId, userId, code);
    return league;
  }
}

export const leagueService = new LeagueService();
