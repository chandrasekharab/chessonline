import { query } from '../config/database';
import {
  Tournament, TournamentTeamEntry, TournamentRound,
  TournamentMatch, TournamentBoard,
  TournamentFormat, TournamentStatus, TimeControl,
} from '../types';

export class TournamentRepository {
  // ── Tournaments ────────────────────────────────────────────────────────────

  async create(params: {
    name: string;
    description?: string;
    organizerId: string;
    leagueId?: string;
    format: TournamentFormat;
    teamSize: number;
    timeControl: TimeControl;
    maxTeams?: number;
    roundsTotal: number;
    startDate?: Date;
  }): Promise<Tournament> {
    const result = await query<Tournament>(
      `INSERT INTO tournaments
         (name, description, organizer_id, league_id, format, team_size,
          time_control, max_teams, rounds_total, start_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        params.name,
        params.description ?? null,
        params.organizerId,
        params.leagueId ?? null,
        params.format,
        params.teamSize,
        params.timeControl,
        params.maxTeams ?? null,
        params.roundsTotal,
        params.startDate ?? null,
      ]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<Tournament | null> {
    const result = await query<Tournament>('SELECT * FROM tournaments WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async list(params: {
    status?: TournamentStatus;
    leagueId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ tournaments: Tournament[]; total: number }> {
    const conds: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (params.status)   { conds.push(`status = $${i++}`);    vals.push(params.status); }
    if (params.leagueId) { conds.push(`league_id = $${i++}`); vals.push(params.leagueId); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const limit  = params.limit  ?? 20;
    const offset = params.offset ?? 0;

    const [data, count] = await Promise.all([
      query<Tournament>(`SELECT * FROM tournaments ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i+1}`,
        [...vals, limit, offset]),
      query<{ count: string }>(`SELECT COUNT(*) FROM tournaments ${where}`, vals),
    ]);
    return { tournaments: data.rows, total: parseInt(count.rows[0]?.count ?? '0', 10) };
  }

  async updateStatus(id: string, status: TournamentStatus): Promise<void> {
    await query('UPDATE tournaments SET status = $1 WHERE id = $2', [status, id]);
  }

  async incrementRoundsDone(id: string): Promise<void> {
    await query('UPDATE tournaments SET rounds_done = rounds_done + 1 WHERE id = $1', [id]);
  }

  // ── Team registration ──────────────────────────────────────────────────────

  async registerTeam(tournamentId: string, teamId: string, seed?: number): Promise<TournamentTeamEntry> {
    const result = await query<TournamentTeamEntry>(
      `INSERT INTO tournament_teams (tournament_id, team_id, seed)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [tournamentId, teamId, seed ?? null]
    );
    return result.rows[0];
  }

  async getStandings(tournamentId: string): Promise<TournamentTeamEntry[]> {
    const result = await query<TournamentTeamEntry>(
      `SELECT tt.*, t.name AS team_name, t.rating AS team_rating
       FROM tournament_teams tt
       JOIN teams t ON t.id = tt.team_id
       WHERE tt.tournament_id = $1
       ORDER BY tt.match_points DESC, tt.board_points DESC`,
      [tournamentId]
    );
    return result.rows;
  }

  async addMatchPoints(tournamentId: string, teamId: string, matchPts: number, boardPts: number): Promise<void> {
    await query(
      `UPDATE tournament_teams
       SET match_points = match_points + $1,
           board_points = board_points + $2
       WHERE tournament_id = $3 AND team_id = $4`,
      [matchPts, boardPts, tournamentId, teamId]
    );
  }

  async getRegisteredTeams(tournamentId: string): Promise<TournamentTeamEntry[]> {
    const result = await query<TournamentTeamEntry>(
      `SELECT tt.*, t.name AS team_name, t.rating AS team_rating
       FROM tournament_teams tt
       JOIN teams t ON t.id = tt.team_id
       WHERE tt.tournament_id = $1
       ORDER BY tt.seed NULLS LAST, t.rating DESC`,
      [tournamentId]
    );
    return result.rows;
  }

  // ── Rounds ─────────────────────────────────────────────────────────────────

  async createRound(tournamentId: string, roundNumber: number): Promise<TournamentRound> {
    const result = await query<TournamentRound>(
      `INSERT INTO tournament_rounds (tournament_id, round_number)
       VALUES ($1, $2)
       RETURNING *`,
      [tournamentId, roundNumber]
    );
    return result.rows[0];
  }

  async getRounds(tournamentId: string): Promise<TournamentRound[]> {
    const result = await query<TournamentRound>(
      'SELECT * FROM tournament_rounds WHERE tournament_id = $1 ORDER BY round_number',
      [tournamentId]
    );
    return result.rows;
  }

  async updateRoundStatus(roundId: string, status: 'pending' | 'active' | 'completed'): Promise<void> {
    await query('UPDATE tournament_rounds SET status = $1 WHERE id = $2', [status, roundId]);
  }

  // ── Matches ────────────────────────────────────────────────────────────────

  async createMatch(params: {
    roundId: string;
    tournamentId: string;
    teamAId: string;
    teamBId: string;
  }): Promise<TournamentMatch> {
    const result = await query<TournamentMatch>(
      `INSERT INTO tournament_matches (round_id, tournament_id, team_a_id, team_b_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [params.roundId, params.tournamentId, params.teamAId, params.teamBId]
    );
    return result.rows[0];
  }

  async getMatchesForRound(roundId: string): Promise<TournamentMatch[]> {
    const result = await query<TournamentMatch>(
      `SELECT tm.*,
              ta.name AS team_a_name,
              tb.name AS team_b_name
       FROM tournament_matches tm
       JOIN teams ta ON ta.id = tm.team_a_id
       JOIN teams tb ON tb.id = tm.team_b_id
       WHERE tm.round_id = $1`,
      [roundId]
    );
    return result.rows;
  }

  async getMatch(matchId: string): Promise<TournamentMatch | null> {
    const result = await query<TournamentMatch>(
      `SELECT tm.*, ta.name AS team_a_name, tb.name AS team_b_name
       FROM tournament_matches tm
       JOIN teams ta ON ta.id = tm.team_a_id
       JOIN teams tb ON tb.id = tm.team_b_id
       WHERE tm.id = $1`,
      [matchId]
    );
    return result.rows[0] ?? null;
  }

  async updateMatchPoints(matchId: string, teamAPoints: number, teamBPoints: number): Promise<void> {
    await query(
      'UPDATE tournament_matches SET team_a_points = $1, team_b_points = $2 WHERE id = $3',
      [teamAPoints, teamBPoints, matchId]
    );
  }

  async updateMatchStatus(matchId: string, status: 'pending' | 'active' | 'completed'): Promise<void> {
    await query('UPDATE tournament_matches SET status = $1 WHERE id = $2', [status, matchId]);
  }

  // ── Boards ─────────────────────────────────────────────────────────────────

  async createBoard(params: {
    matchId: string;
    boardNumber: number;
    whiteUserId?: string;
    blackUserId?: string;
  }): Promise<TournamentBoard> {
    const result = await query<TournamentBoard>(
      `INSERT INTO tournament_boards (match_id, board_number, white_user_id, black_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [params.matchId, params.boardNumber, params.whiteUserId ?? null, params.blackUserId ?? null]
    );
    return result.rows[0];
  }

  async getBoardsForMatch(matchId: string): Promise<TournamentBoard[]> {
    const result = await query<TournamentBoard>(
      'SELECT * FROM tournament_boards WHERE match_id = $1 ORDER BY board_number',
      [matchId]
    );
    return result.rows;
  }

  async setBoardResult(boardId: string, result: 'white' | 'black' | 'draw', liveGameId?: string): Promise<void> {
    await query(
      'UPDATE tournament_boards SET result = $1, live_game_id = COALESCE($2, live_game_id) WHERE id = $3',
      [result, liveGameId ?? null, boardId]
    );
  }
}

export const tournamentRepository = new TournamentRepository();
