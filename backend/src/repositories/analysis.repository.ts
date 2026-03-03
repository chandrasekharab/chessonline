import { query, pool } from '../config/database';
import { AnalysisRow, MoveLabel } from '../types';

export interface InsertAnalysisRow {
  gameId: string;
  moveNumber: number;
  move: string;
  fen: string;
  evalBefore: number | null;
  evalAfter: number | null;
  evalDiff: number | null;
  label: MoveLabel;
  bestMove: string | null;
  explanation: string | null;
}

export class AnalysisRepository {
  async insertBatch(rows: InsertAnalysisRow[]): Promise<void> {
    if (rows.length === 0) return;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete previous analysis for this game
      await client.query('DELETE FROM analysis WHERE game_id = $1', [rows[0].gameId]);

      // Bulk insert using unnest
      const gameIds = rows.map((r) => r.gameId);
      const moveNumbers = rows.map((r) => r.moveNumber);
      const moves = rows.map((r) => r.move);
      const fens = rows.map((r) => r.fen);
      const evalBefores = rows.map((r) => r.evalBefore);
      const evalAfters = rows.map((r) => r.evalAfter);
      const evalDiffs = rows.map((r) => r.evalDiff);
      const labels = rows.map((r) => r.label);
      const bestMoves = rows.map((r) => r.bestMove);
      const explanations = rows.map((r) => r.explanation);

      await client.query(
        `INSERT INTO analysis
          (game_id, move_number, move, fen, eval_before, eval_after, eval_diff, label, best_move, explanation)
         SELECT * FROM UNNEST(
           $1::uuid[], $2::int[], $3::text[], $4::text[],
           $5::numeric[], $6::numeric[], $7::numeric[],
           $8::text[], $9::text[], $10::text[]
         )`,
        [gameIds, moveNumbers, moves, fens, evalBefores, evalAfters, evalDiffs, labels, bestMoves, explanations]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findByGame(gameId: string): Promise<AnalysisRow[]> {
    const { rows } = await query<AnalysisRow>(
      `SELECT * FROM analysis WHERE game_id = $1 ORDER BY move_number ASC`,
      [gameId]
    );
    return rows;
  }

  async deleteByGame(gameId: string): Promise<void> {
    await query('DELETE FROM analysis WHERE game_id = $1', [gameId]);
  }

  async getSummary(gameId: string): Promise<Record<string, number>> {
    const { rows } = await query<{ label: string; count: string }>(
      `SELECT label, COUNT(*) as count FROM analysis WHERE game_id = $1 GROUP BY label`,
      [gameId]
    );
    const summary: Record<string, number> = {};
    for (const row of rows) {
      summary[row.label] = parseInt(row.count, 10);
    }
    return summary;
  }
}
