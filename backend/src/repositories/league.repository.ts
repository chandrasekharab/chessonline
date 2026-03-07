import { query } from '../config/database';
import {
  League, LeagueTeamEntry, LeagueAnnouncement,
  LeagueVisibility, LeagueStatus,
} from '../types';
import crypto from 'crypto';

export class LeagueRepository {
  // ── Leagues ────────────────────────────────────────────────────────────────

  async create(params: {
    name: string;
    description?: string;
    organizerId: string;
    visibility: LeagueVisibility;
    season?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<League> {
    const inviteCode = params.visibility === 'private'
      ? crypto.randomBytes(5).toString('hex').toUpperCase()
      : null;

    const result = await query<League>(
      `INSERT INTO leagues
         (name, description, organizer_id, visibility, invite_code, season, start_date, end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        params.name,
        params.description ?? null,
        params.organizerId,
        params.visibility,
        inviteCode,
        params.season ?? 1,
        params.startDate ?? null,
        params.endDate ?? null,
      ]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<League | null> {
    const result = await query<League>('SELECT * FROM leagues WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async findByInviteCode(code: string): Promise<League | null> {
    const result = await query<League>(
      "SELECT * FROM leagues WHERE invite_code = $1 AND status = 'active'",
      [code]
    );
    return result.rows[0] ?? null;
  }

  async list(params: {
    organizerId?: string;
    visibility?: LeagueVisibility;
    status?: LeagueStatus;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ leagues: League[]; total: number }> {
    const conds: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (params.organizerId) { conds.push(`organizer_id = $${i++}`); vals.push(params.organizerId); }
    if (params.visibility)  { conds.push(`visibility = $${i++}`);   vals.push(params.visibility); }
    if (params.status)      { conds.push(`status = $${i++}`);       vals.push(params.status); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const limit  = params.limit  ?? 20;
    const offset = params.offset ?? 0;

    const [data, count] = await Promise.all([
      query<League>(`SELECT * FROM leagues ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i+1}`,
        [...vals, limit, offset]),
      query<{ count: string }>(`SELECT COUNT(*) FROM leagues ${where}`, vals),
    ]);
    return { leagues: data.rows, total: parseInt(count.rows[0]?.count ?? '0', 10) };
  }

  async update(id: string, params: {
    name?: string;
    description?: string | null;
    status?: LeagueStatus;
    endDate?: Date | null;
  }): Promise<League | null> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (params.name        !== undefined) { sets.push(`name = $${i++}`);        vals.push(params.name); }
    if (params.description !== undefined) { sets.push(`description = $${i++}`); vals.push(params.description); }
    if (params.status      !== undefined) { sets.push(`status = $${i++}`);       vals.push(params.status); }
    if (params.endDate     !== undefined) { sets.push(`end_date = $${i++}`);     vals.push(params.endDate); }
    if (sets.length === 0) return this.findById(id);
    vals.push(id);
    const result = await query<League>(
      `UPDATE leagues SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    return result.rows[0] ?? null;
  }

  // ── League Teams ───────────────────────────────────────────────────────────

  async addTeam(leagueId: string, teamId: string, approved = false): Promise<LeagueTeamEntry> {
    const result = await query<LeagueTeamEntry>(
      `INSERT INTO league_teams (league_id, team_id, approved)
       VALUES ($1, $2, $3)
       ON CONFLICT (league_id, team_id) DO NOTHING
       RETURNING *`,
      [leagueId, teamId, approved]
    );
    return result.rows[0];
  }

  async approveTeam(leagueId: string, teamId: string): Promise<void> {
    await query(
      'UPDATE league_teams SET approved = true WHERE league_id = $1 AND team_id = $2',
      [leagueId, teamId]
    );
  }

  async removeTeam(leagueId: string, teamId: string): Promise<void> {
    await query('DELETE FROM league_teams WHERE league_id = $1 AND team_id = $2', [leagueId, teamId]);
  }

  async getLeagueTeams(leagueId: string, onlyApproved = false): Promise<LeagueTeamEntry[]> {
    const filter = onlyApproved ? 'AND lt.approved = true' : '';
    const result = await query<LeagueTeamEntry>(
      `SELECT lt.*, t.name AS team_name, t.rating AS team_rating
       FROM league_teams lt
       JOIN teams t ON t.id = lt.team_id
       WHERE lt.league_id = $1 ${filter}
       ORDER BY t.rating DESC`,
      [leagueId]
    );
    return result.rows;
  }

  async getTeamLeagues(teamId: string): Promise<League[]> {
    const result = await query<League>(
      `SELECT l.* FROM leagues l
       JOIN league_teams lt ON lt.league_id = l.id
       WHERE lt.team_id = $1 AND lt.approved = true
       ORDER BY l.created_at DESC`,
      [teamId]
    );
    return result.rows;
  }

  // ── Announcements ──────────────────────────────────────────────────────────

  async createAnnouncement(leagueId: string, authorId: string, body: string): Promise<LeagueAnnouncement> {
    const result = await query<LeagueAnnouncement>(
      `INSERT INTO league_announcements (league_id, author_id, body)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [leagueId, authorId, body]
    );
    return result.rows[0];
  }

  async getAnnouncements(leagueId: string, limit = 20): Promise<LeagueAnnouncement[]> {
    const result = await query<LeagueAnnouncement>(
      `SELECT la.*, u.email AS author_email
       FROM league_announcements la
       JOIN users u ON u.id = la.author_id
       WHERE la.league_id = $1
       ORDER BY la.created_at DESC
       LIMIT $2`,
      [leagueId, limit]
    );
    return result.rows;
  }
}

export const leagueRepository = new LeagueRepository();
