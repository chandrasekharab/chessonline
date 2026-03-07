import { query } from '../config/database';
import {
  ConsultationGame, ConsultationSuggestion,
  ConsultationStatus, ConsultationSide,
  LiveMove, GameWinner, GameTermination, TimeControl,
} from '../types';
import crypto from 'crypto';

export class ConsultationRepository {
  async create(params: {
    whitePlayer1Id: string;
    whitePlayer2Id?: string;
    blackPlayer1Id?: string;
    blackPlayer2Id?: string;
    whiteTeamId?: string;
    blackTeamId?: string;
    whiteExecutorId: string;
    timeControl: TimeControl;
    whiteTimeMs: number;
    blackTimeMs: number;
  }): Promise<ConsultationGame> {
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const result = await query<ConsultationGame>(
      `INSERT INTO consultation_games
         (white_player1_id, white_player2_id, black_player1_id, black_player2_id,
          white_team_id, black_team_id, white_executor_id,
          time_control, white_time_ms, black_time_ms, invite_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        params.whitePlayer1Id,
        params.whitePlayer2Id ?? null,
        params.blackPlayer1Id ?? null,
        params.blackPlayer2Id ?? null,
        params.whiteTeamId ?? null,
        params.blackTeamId ?? null,
        params.whiteExecutorId,
        params.timeControl,
        params.whiteTimeMs,
        params.blackTimeMs,
        inviteCode,
      ]
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<ConsultationGame | null> {
    const result = await query<ConsultationGame>(
      'SELECT * FROM consultation_games WHERE id = $1',
      [id]
    );
    return result.rows[0] ?? null;
  }

  async findByInviteCode(code: string): Promise<ConsultationGame | null> {
    const result = await query<ConsultationGame>(
      "SELECT * FROM consultation_games WHERE invite_code = $1 AND status IN ('waiting','active')",
      [code]
    );
    return result.rows[0] ?? null;
  }

  async setBlackSide(id: string, params: {
    blackPlayer1Id: string;
    blackPlayer2Id?: string;
    blackTeamId?: string;
    blackExecutorId: string;
  }): Promise<void> {
    await query(
      `UPDATE consultation_games
       SET black_player1_id = $1, black_player2_id = $2,
           black_team_id = $3, black_executor_id = $4,
           status = 'active'
       WHERE id = $5`,
      [
        params.blackPlayer1Id,
        params.blackPlayer2Id ?? null,
        params.blackTeamId ?? null,
        params.blackExecutorId,
        id,
      ]
    );
  }

  async applyMove(id: string, fen: string, move: LiveMove, whiteMsLeft: number, blackMsLeft: number): Promise<void> {
    await query(
      `UPDATE consultation_games
       SET fen = $1,
           move_history_json = move_history_json || $2::jsonb,
           white_time_ms = $3,
           black_time_ms = $4,
           last_move_at = NOW()
       WHERE id = $5`,
      [fen, JSON.stringify(move), whiteMsLeft, blackMsLeft, id]
    );
  }

  async updateStatus(id: string, status: ConsultationStatus, winner?: GameWinner, termination?: GameTermination): Promise<void> {
    await query(
      'UPDATE consultation_games SET status = $1, winner = $2, termination = $3 WHERE id = $4',
      [status, winner ?? null, termination ?? 'normal', id]
    );
  }

  async getActiveByUser(userId: string): Promise<ConsultationGame[]> {
    const result = await query<ConsultationGame>(
      `SELECT * FROM consultation_games
       WHERE status = 'active'
         AND (white_player1_id = $1 OR white_player2_id = $1
              OR black_player1_id = $1 OR black_player2_id = $1)`,
      [userId]
    );
    return result.rows;
  }

  // ── Suggestions ────────────────────────────────────────────────────────────

  async addSuggestion(params: {
    gameId: string;
    suggestedBy: string;
    uci: string;
    san?: string;
    moveNumber: number;
    side: ConsultationSide;
  }): Promise<ConsultationSuggestion> {
    // Prevent duplicate uci for same move/side (upsert votes instead)
    const existing = await query<ConsultationSuggestion>(
      `SELECT * FROM consultation_suggestions
       WHERE game_id = $1 AND move_number = $2 AND side = $3 AND uci = $4 AND executed = false`,
      [params.gameId, params.moveNumber, params.side, params.uci]
    );
    if (existing.rows[0]) {
      // Vote for the existing suggestion instead
      return this.vote(existing.rows[0].id, params.suggestedBy);
    }

    const result = await query<ConsultationSuggestion>(
      `INSERT INTO consultation_suggestions
         (game_id, suggested_by, uci, san, move_number, side, voter_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       RETURNING *`,
      [
        params.gameId, params.suggestedBy,
        params.uci, params.san ?? null,
        params.moveNumber, params.side,
        JSON.stringify([params.suggestedBy]),
      ]
    );
    return result.rows[0];
  }

  async vote(suggestionId: string, userId: string): Promise<ConsultationSuggestion> {
    const result = await query<ConsultationSuggestion>(
      `UPDATE consultation_suggestions
       SET votes = votes + 1,
           voter_ids = CASE
             WHEN voter_ids @> $1::jsonb THEN voter_ids
             ELSE voter_ids || $1::jsonb
           END
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify([userId]), suggestionId]
    );
    return result.rows[0];
  }

  async getSuggestions(gameId: string, moveNumber: number, side: ConsultationSide): Promise<ConsultationSuggestion[]> {
    const result = await query<ConsultationSuggestion>(
      `SELECT cs.*, u.email AS suggester_email
       FROM consultation_suggestions cs
       JOIN users u ON u.id = cs.suggested_by
       WHERE cs.game_id = $1 AND cs.move_number = $2 AND cs.side = $3 AND cs.executed = false
       ORDER BY cs.votes DESC`,
      [gameId, moveNumber, side]
    );
    return result.rows;
  }

  async markExecuted(suggestionId: string): Promise<void> {
    await query('UPDATE consultation_suggestions SET executed = true WHERE id = $1', [suggestionId]);
  }
}

export const consultationRepository = new ConsultationRepository();
