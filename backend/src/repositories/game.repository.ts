import { query } from '../config/database';
import { Game, GameStatus, GameMetadata } from '../types';

export class GameRepository {
  async create(userId: string, pgn: string, metadata: GameMetadata): Promise<Game> {
    const { rows } = await query<Game>(
      `INSERT INTO games (user_id, pgn, metadata_json, status)
       VALUES ($1, $2, $3, 'uploaded')
       RETURNING *`,
      [userId, pgn, JSON.stringify(metadata)]
    );
    return rows[0];
  }

  async findByUser(userId: string, limit = 50, offset = 0): Promise<Game[]> {
    const { rows } = await query<Game>(
      `SELECT * FROM games
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  }

  async findById(id: string): Promise<Game | null> {
    const { rows } = await query<Game>(
      'SELECT * FROM games WHERE id = $1 LIMIT 1',
      [id]
    );
    return rows[0] ?? null;
  }

  async findByIdAndUser(id: string, userId: string): Promise<Game | null> {
    const { rows } = await query<Game>(
      'SELECT * FROM games WHERE id = $1 AND user_id = $2 LIMIT 1',
      [id, userId]
    );
    return rows[0] ?? null;
  }

  async updateStatus(id: string, status: GameStatus): Promise<void> {
    await query(
      `UPDATE games SET status = $1, updated_at = NOW() WHERE id = $2`,
      [status, id]
    );
  }

  async updateProgress(id: string, current: number, total: number): Promise<void> {
    await query(
      `UPDATE games SET progress_current = $1, progress_total = $2, updated_at = NOW() WHERE id = $3`,
      [current, total, id]
    );
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const { rowCount } = await query(
      'DELETE FROM games WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return (rowCount ?? 0) > 0;
  }

  async countByUser(userId: string): Promise<number> {
    const { rows } = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM games WHERE user_id = $1',
      [userId]
    );
    return parseInt(rows[0].count, 10);
  }
}
