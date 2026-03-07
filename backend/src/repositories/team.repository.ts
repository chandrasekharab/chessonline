import { query } from '../config/database';
import {
  Team, TeamMember, TeamInvite, TeamRole,
} from '../types';
import crypto from 'crypto';

export class TeamRepository {
  // ── Teams ──────────────────────────────────────────────────────────────────

  async create(params: {
    name: string;
    captainId: string;
    logoUrl?: string;
    description?: string;
  }): Promise<Team> {
    const result = await query<Team>(
      `INSERT INTO teams (name, captain_id, logo_url, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [params.name, params.captainId, params.logoUrl ?? null, params.description ?? null]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<Team | null> {
    const result = await query<Team>('SELECT * FROM teams WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async findByName(name: string): Promise<Team | null> {
    const result = await query<Team>('SELECT * FROM teams WHERE LOWER(name) = LOWER($1)', [name]);
    return result.rows[0] ?? null;
  }

  async search(q: string, limit = 20): Promise<Team[]> {
    const result = await query<Team>(
      `SELECT * FROM teams WHERE name ILIKE $1 ORDER BY rating DESC LIMIT $2`,
      [`%${q}%`, limit]
    );
    return result.rows;
  }

  async list(limit = 20, offset = 0): Promise<{ teams: Team[]; total: number }> {
    const [data, count] = await Promise.all([
      query<Team>('SELECT * FROM teams ORDER BY rating DESC LIMIT $1 OFFSET $2', [limit, offset]),
      query<{ count: string }>('SELECT COUNT(*) FROM teams'),
    ]);
    return { teams: data.rows, total: parseInt(count.rows[0]?.count ?? '0', 10) };
  }

  async update(id: string, params: {
    name?: string;
    logoUrl?: string | null;
    description?: string | null;
  }): Promise<Team | null> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (params.name !== undefined)        { sets.push(`name = $${i++}`);        vals.push(params.name); }
    if (params.logoUrl !== undefined)     { sets.push(`logo_url = $${i++}`);    vals.push(params.logoUrl); }
    if (params.description !== undefined) { sets.push(`description = $${i++}`); vals.push(params.description); }
    if (sets.length === 0) return this.findById(id);
    vals.push(id);
    const result = await query<Team>(
      `UPDATE teams SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    return result.rows[0] ?? null;
  }

  async updateStats(id: string, delta: { wins?: number; losses?: number; draws?: number; ratingDelta?: number }): Promise<void> {
    await query(
      `UPDATE teams SET
         wins   = wins   + $1,
         losses = losses + $2,
         draws  = draws  + $3,
         rating = rating + $4
       WHERE id = $5`,
      [delta.wins ?? 0, delta.losses ?? 0, delta.draws ?? 0, delta.ratingDelta ?? 0, id]
    );
  }

  async delete(id: string): Promise<void> {
    await query('DELETE FROM teams WHERE id = $1', [id]);
  }

  // ── Members ────────────────────────────────────────────────────────────────

  async addMember(teamId: string, userId: string, role: TeamRole = 'player'): Promise<TeamMember> {
    const result = await query<TeamMember>(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [teamId, userId, role]
    );
    return result.rows[0];
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    await query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
  }

  async updateMemberRole(teamId: string, userId: string, role: TeamRole): Promise<void> {
    await query(
      'UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3',
      [role, teamId, userId]
    );
  }

  async getMembers(teamId: string): Promise<TeamMember[]> {
    const result = await query<TeamMember>(
      `SELECT tm.*, u.email, u.rating
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1
       ORDER BY tm.role, u.email`,
      [teamId]
    );
    return result.rows;
  }

  async getMember(teamId: string, userId: string): Promise<TeamMember | null> {
    const result = await query<TeamMember>(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );
    return result.rows[0] ?? null;
  }

  async getUserTeams(userId: string): Promise<(Team & { role: TeamRole })[]> {
    const result = await query<Team & { role: TeamRole }>(
      `SELECT t.*, tm.role
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = $1
       ORDER BY t.rating DESC`,
      [userId]
    );
    return result.rows;
  }

  // ── Invites ────────────────────────────────────────────────────────────────

  async createInvite(teamId: string, createdBy: string, maxUses?: number): Promise<TeamInvite> {
    const token = crypto.randomBytes(16).toString('hex');
    const result = await query<TeamInvite>(
      `INSERT INTO team_invites (team_id, token, created_by, max_uses)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [teamId, token, createdBy, maxUses ?? null]
    );
    return result.rows[0];
  }

  async findInviteByToken(token: string): Promise<TeamInvite | null> {
    const result = await query<TeamInvite>(
      `SELECT * FROM team_invites
       WHERE token = $1
         AND expires_at > NOW()
         AND (max_uses IS NULL OR use_count < max_uses)`,
      [token]
    );
    return result.rows[0] ?? null;
  }

  async incrementInviteUse(token: string): Promise<void> {
    await query('UPDATE team_invites SET use_count = use_count + 1 WHERE token = $1', [token]);
  }

  async getTeamInvites(teamId: string): Promise<TeamInvite[]> {
    const result = await query<TeamInvite>(
      'SELECT * FROM team_invites WHERE team_id = $1 ORDER BY created_at DESC',
      [teamId]
    );
    return result.rows;
  }

  async revokeInvite(id: string, teamId: string): Promise<void> {
    await query('DELETE FROM team_invites WHERE id = $1 AND team_id = $2', [id, teamId]);
  }
}

export const teamRepository = new TeamRepository();
