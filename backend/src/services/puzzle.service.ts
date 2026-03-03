import { Chess } from 'chess.js';
import { pool } from '../config/database';

// ── Types ──────────────────────────────────────────────────────────────────

interface PuzzleRow {
  id: string;
  fen: string;
  solution_uci: string;
  theme: string;
  difficulty: number;
  title: string;
  description: string;
  rating: number;
}

export interface PuzzlePublic {
  id: string;
  fen: string;
  theme: string;
  difficulty: number;
  title: string;
  description: string;
  total_player_moves: number;
}

export interface CheckMoveResult {
  correct: boolean;
  solved: boolean;
  engine_reply_uci?: string;
  engine_reply_fen?: string;
  solution_uci?: string;
  feedback: string;
}

export interface PuzzleStats {
  solved_count: number;
  attempted_count: number;
  accuracy: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function solutionMoves(uci: string): string[] {
  return uci.trim().split(/\s+/).filter(Boolean);
}

/** Count how many moves the *player* must make (even indices: 0,2,4…) */
function totalPlayerMoves(moves: string[]): number {
  return moves.filter((_, i) => i % 2 === 0).length;
}

function toPuzzlePublic(p: PuzzleRow): PuzzlePublic {
  return {
    id: p.id,
    fen: p.fen,
    theme: p.theme,
    difficulty: p.difficulty,
    title: p.title,
    description: p.description,
    total_player_moves: totalPlayerMoves(solutionMoves(p.solution_uci)),
  };
}

// ── Service functions ──────────────────────────────────────────────────────

/**
 * Return a puzzle the user hasn't solved yet.
 * Falls back to any random puzzle if all are solved.
 */
export async function getNextPuzzle(
  userId: string,
  theme?: string,
  difficulty?: number,
): Promise<PuzzlePublic | null> {
  const params: (string | number)[] = [userId];
  const conditions: string[] = [
    `p.id NOT IN (SELECT puzzle_id FROM puzzle_attempts WHERE user_id = $1 AND solved = true)`,
  ];

  if (theme) {
    params.push(theme);
    conditions.push(`p.theme = $${params.length}`);
  }
  if (difficulty) {
    params.push(difficulty);
    conditions.push(`p.difficulty = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `SELECT p.* FROM puzzles p ${where} ORDER BY p.difficulty ASC, RANDOM() LIMIT 1`;

  let result = await pool.query<PuzzleRow>(query, params);

  if (result.rows.length === 0) {
    // No unsolved puzzles at this difficulty — fall back to any unsolved puzzle
    // (drop the difficulty constraint so we always return something)
    result = await pool.query<PuzzleRow>(
      `SELECT p.* FROM puzzles p
       WHERE p.id NOT IN (
         SELECT puzzle_id FROM puzzle_attempts WHERE user_id = $1 AND solved = true
       )
       ORDER BY p.difficulty ASC, RANDOM() LIMIT 1`,
      [userId],
    );
  }

  if (result.rows.length === 0) {
    // All puzzles solved — return any random puzzle ignoring filters
    result = await pool.query<PuzzleRow>(
      `SELECT * FROM puzzles ORDER BY RANDOM() LIMIT 1`,
    );
  }

  return result.rows.length ? toPuzzlePublic(result.rows[0]) : null;
}

/**
 * Validate a player move against the expected solution.
 * solutionIndex is the 0-based index into solution_moves (always even = player turn).
 */
export async function checkMove(
  puzzleId: string,
  userId: string,
  moveUci: string,
  currentFen: string,
  solutionIndex: number,
): Promise<CheckMoveResult> {
  const result = await pool.query<PuzzleRow>('SELECT * FROM puzzles WHERE id = $1', [puzzleId]);
  if (!result.rows.length) throw new Error('Puzzle not found');
  const puzzle = result.rows[0];

  const moves = solutionMoves(puzzle.solution_uci);
  if (solutionIndex >= moves.length || solutionIndex % 2 !== 0) {
    throw new Error('Invalid solution index');
  }

  const expected = moves[solutionIndex].toLowerCase();
  const played   = moveUci.toLowerCase().trim();

  if (played !== expected) {
    return {
      correct: false,
      solved: false,
      feedback: 'Incorrect — try again! Look for a better move.',
    };
  }

  // Apply the correct player move
  const chess = new Chess(currentFen);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chess.move(moveUci as any);
  const fenAfterPlayer = chess.fen();

  const engineIndex = solutionIndex + 1;

  // No engine reply → puzzle solved immediately after player move
  if (engineIndex >= moves.length) {
    await upsertAttempt(userId, puzzleId, true, solutionIndex + 1);
    return {
      correct: true,
      solved: true,
      solution_uci: puzzle.solution_uci,
      feedback: '✓ Excellent! Puzzle solved!',
    };
  }

  // Apply engine reply
  const engineUci = moves[engineIndex];
  const chessAfterEngine = new Chess(fenAfterPlayer);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chessAfterEngine.move(engineUci as any);
  const fenAfterEngine = chessAfterEngine.fen();

  const nextPlayerIndex = engineIndex + 1;
  const solved = nextPlayerIndex >= moves.length;

  if (solved) {
    await upsertAttempt(userId, puzzleId, true, nextPlayerIndex);
    return {
      correct: true,
      solved: true,
      engine_reply_uci: engineUci,
      engine_reply_fen: fenAfterEngine,
      solution_uci: puzzle.solution_uci,
      feedback: '✓ Excellent! Puzzle solved!',
    };
  }

  return {
    correct: true,
    solved: false,
    engine_reply_uci: engineUci,
    engine_reply_fen: fenAfterEngine,
    feedback: '✓ Good move! Keep going…',
  };
}

/**
 * User gives up — record as attempted (not solved) and reveal the solution.
 */
export async function resignPuzzle(
  puzzleId: string,
  userId: string,
): Promise<{ solution_uci: string }> {
  const result = await pool.query<PuzzleRow>('SELECT solution_uci FROM puzzles WHERE id = $1', [puzzleId]);
  if (!result.rows.length) throw new Error('Puzzle not found');

  await pool.query(
    `INSERT INTO puzzle_attempts (user_id, puzzle_id, solved)
     VALUES ($1, $2, false)
     ON CONFLICT (user_id, puzzle_id) DO NOTHING`,
    [userId, puzzleId],
  );

  return { solution_uci: result.rows[0].solution_uci };
}

/** Aggregate puzzle statistics for a user. */
export async function getUserStats(userId: string): Promise<PuzzleStats> {
  const res = await pool.query<{ solved_count: string; attempted_count: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE solved = true) AS solved_count,
       COUNT(*) AS attempted_count
     FROM puzzle_attempts
     WHERE user_id = $1`,
    [userId],
  );
  const row = res.rows[0];
  const solved   = parseInt(row.solved_count,   10) || 0;
  const attempted = parseInt(row.attempted_count, 10) || 0;
  return {
    solved_count:    solved,
    attempted_count: attempted,
    accuracy: attempted > 0 ? Math.round((solved / attempted) * 100) : 0,
  };
}

// ── Internal helpers ───────────────────────────────────────────────────────

async function upsertAttempt(
  userId: string,
  puzzleId: string,
  solved: boolean,
  movesPlayed: number,
) {
  await pool.query(
    `INSERT INTO puzzle_attempts (user_id, puzzle_id, solved, moves_played)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, puzzle_id)
     DO UPDATE SET solved = $3, moves_played = $4, updated_at = NOW()`,
    [userId, puzzleId, solved, movesPlayed],
  );
}
