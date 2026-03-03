import { query } from '../config/database';
import { LiveGame, LiveGameView, LiveMove, GameWinner, GameTermination, TimeControl } from '../types';

export class LiveGameRepository {
  async create(params: {
    whiteUserId: string;
    blackUserId: string | null;
    timeControl: TimeControl;
    whiteTimeMs: number;
    blackTimeMs: number;
    inviteCode?: string;
  }): Promise<LiveGame> {
    const result = await query<LiveGame>(
      `INSERT INTO live_games
         (white_user_id, black_user_id, time_control, white_time_ms, black_time_ms, invite_code)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        params.whiteUserId,
        params.blackUserId,
        params.timeControl,
        params.whiteTimeMs,
        params.blackTimeMs,
        params.inviteCode ?? null,
      ]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<LiveGame | null> {
    const result = await query<LiveGame>(
      'SELECT * FROM live_games WHERE id = $1',
      [id]
    );
    return result.rows[0] ?? null;
  }

  async findByIdWithUsers(id: string): Promise<LiveGameView | null> {
    const result = await query<LiveGameView>(
      `SELECT lg.*,
              wu.email AS white_email, wu.rating AS white_rating,
              bu.email AS black_email, bu.rating AS black_rating
       FROM live_games lg
       LEFT JOIN users wu ON wu.id = lg.white_user_id
       LEFT JOIN users bu ON bu.id = lg.black_user_id
       WHERE lg.id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async findByInviteCode(code: string): Promise<LiveGame | null> {
    const result = await query<LiveGame>(
      "SELECT * FROM live_games WHERE invite_code = $1 AND status = 'waiting'",
      [code]
    );
    return result.rows[0] ?? null;
  }

  async findActiveByUser(userId: string): Promise<LiveGameView | null> {
    const result = await query<LiveGameView>(
      `SELECT lg.*,
              wu.email AS white_email, wu.rating AS white_rating,
              bu.email AS black_email, bu.rating AS black_rating
       FROM live_games lg
       LEFT JOIN users wu ON wu.id = lg.white_user_id
       LEFT JOIN users bu ON bu.id = lg.black_user_id
       WHERE (lg.white_user_id = $1 OR lg.black_user_id = $1)
         AND lg.status = 'active'
       ORDER BY lg.updated_at DESC
       LIMIT 1`,
      [userId]
    );
    return result.rows[0] ?? null;
  }

  async findCompletedByUser(userId: string, limit = 20): Promise<LiveGameView[]> {
    const result = await query<LiveGameView>(
      `SELECT lg.*,
              wu.email AS white_email, wu.rating AS white_rating,
              bu.email AS black_email, bu.rating AS black_rating
       FROM live_games lg
       LEFT JOIN users wu ON wu.id = lg.white_user_id
       LEFT JOIN users bu ON bu.id = lg.black_user_id
       WHERE (lg.white_user_id = $1 OR lg.black_user_id = $1)
         AND lg.status = 'completed'
       ORDER BY lg.updated_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  async setBlackPlayer(id: string, blackUserId: string): Promise<void> {
    await query(
      "UPDATE live_games SET black_user_id = $1, status = 'active', updated_at = NOW() WHERE id = $2",
      [blackUserId, id]
    );
  }

  async updateMove(params: {
    id: string;
    fen: string;
    moveHistory: LiveMove[];
    whiteTimeMs: number;
    blackTimeMs: number;
  }): Promise<void> {
    await query(
      `UPDATE live_games
       SET fen = $1,
           move_history_json = $2,
           white_time_ms = $3,
           black_time_ms = $4,
           last_move_at = NOW(),
           updated_at = NOW()
       WHERE id = $5`,
      [
        params.fen,
        JSON.stringify(params.moveHistory),
        params.whiteTimeMs,
        params.blackTimeMs,
        params.id,
      ]
    );
  }

  async complete(params: {
    id: string;
    winner: GameWinner | null;
    termination: GameTermination;
    analysisGameId?: string;
  }): Promise<void> {
    await query(
      `UPDATE live_games
       SET status = 'completed',
           winner = $1,
           termination = $2,
           analysis_game_id = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [params.winner, params.termination, params.analysisGameId ?? null, params.id]
    );
  }

  async abandon(id: string): Promise<void> {
    await query(
      "UPDATE live_games SET status = 'abandoned', termination = 'abandoned', updated_at = NOW() WHERE id = $1",
      [id]
    );
  }

  async saveRatingHistory(params: {
    userId: string;
    liveGameId: string;
    ratingBefore: number;
    ratingAfter: number;
    ratingChange: number;
  }): Promise<void> {
    await query(
      `INSERT INTO rating_history (user_id, live_game_id, rating_before, rating_after, rating_change)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        params.userId,
        params.liveGameId,
        params.ratingBefore,
        params.ratingAfter,
        params.ratingChange,
      ]
    );
  }
}

export const liveGameRepository = new LiveGameRepository();
