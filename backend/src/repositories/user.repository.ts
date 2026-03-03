import { query } from '../config/database';
import { User } from '../types';

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await query<User>(
      'SELECT * FROM users WHERE email = $1 LIMIT 1',
      [email.toLowerCase()]
    );
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const { rows } = await query<User>(
      'SELECT * FROM users WHERE id = $1 LIMIT 1',
      [id]
    );
    return rows[0] ?? null;
  }

  async create(email: string, passwordHash: string): Promise<User> {
    const { rows } = await query<User>(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING *`,
      [email.toLowerCase(), passwordHash]
    );
    return rows[0];
  }

  async updateRating(userId: string, newRating: number): Promise<void> {
    await query('UPDATE users SET rating = $1 WHERE id = $2', [newRating, userId]);
  }

  async findByEmailLike(partial: string, limit = 10): Promise<User[]> {
    const { rows } = await query<User>(
      'SELECT id, email, rating, created_at FROM users WHERE email ILIKE $1 LIMIT $2',
      [`%${partial}%`, limit]
    );
    return rows;
  }
}

export const userRepository = new UserRepository();
