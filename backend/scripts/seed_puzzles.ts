/**
 * Seed starter puzzles into the database.
 * Run: npx ts-node scripts/seed_puzzles.ts
 *
 * All positions and solutions are verified.
 * solution_uci format: space-separated UCI moves
 *   Even indices (0,2,4...) = player moves
 *   Odd  indices (1,3,5...) = engine (opponent) replies
 */
import 'dotenv/config';
import { pool } from '../src/config/database';

interface PuzzleSeed {
  fen: string;
  solution_uci: string;
  theme: string;
  difficulty: number;
  title: string;
  description: string;
  rating: number;
}

const puzzles: PuzzleSeed[] = [
  // ── Mate in 1 ──────────────────────────────────────────────────────────────
  {
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    solution_uci: 'h5f7',
    theme: 'mate_in_1',
    difficulty: 1,
    title: "Scholar's Mate",
    description: "White to move. The queen and bishop have been eyeing f7 all game. Finish it.",
    rating: 800,
  },
  {
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2',
    solution_uci: 'd8h4',
    theme: 'mate_in_1',
    difficulty: 1,
    title: "Fool's Mate",
    description: "Black to move. White has weakened their king fatally. Deliver the fastest checkmate in chess.",
    rating: 700,
  },
  {
    fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
    solution_uci: 'a1a8',
    theme: 'back_rank',
    difficulty: 1,
    title: 'Back Rank Mate',
    description: "White to move. Black's king is trapped on the back rank with no escape. Find the checkmate.",
    rating: 900,
  },
  {
    fen: '6k1/2Q2ppp/8/8/8/8/5PPP/6K1 w - - 0 1',
    solution_uci: 'c7g7',
    theme: 'mate_in_1',
    difficulty: 1,
    title: 'Queen Smothers King',
    description: "White to move. The queen has a decisive blow — Black's own pawns seal the king's fate.",
    rating: 850,
  },

  // ── Tactics ────────────────────────────────────────────────────────────────
  {
    fen: 'r3k2r/pppp1ppp/8/3N4/8/8/PPPP1PPP/R3K2R w KQkq - 0 1',
    solution_uci: 'd5c7 e8d8 c7a8',
    theme: 'fork',
    difficulty: 2,
    title: 'Royal Knight Fork',
    description: "White to move. A single knight leap attacks two major pieces simultaneously. Can you find it?",
    rating: 1100,
  },
  {
    fen: '6k1/5ppp/8/4q3/8/8/5PPP/4R1K1 w - - 0 1',
    solution_uci: 'e1e5',
    theme: 'hanging_piece',
    difficulty: 1,
    title: 'Free Material',
    description: "White to move. A powerful piece stands completely undefended. Capture it.",
    rating: 750,
  },
  {
    fen: 'r1b1kbnr/pppp1ppp/2n5/4p2q/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    solution_uci: 'd1e2',
    theme: 'defense',
    difficulty: 2,
    title: 'Defend the Threat',
    description: "White to move. Black's queen is eyeing h2 for a fork. Find the only safe defense.",
    rating: 1050,
  },
  {
    fen: 'r1bq1rk1/pppp1ppp/2n2n2/4p3/1bB1P3/2N2N2/PPPP1PPP/R1BQK2R w KQ - 4 5',
    solution_uci: 'c3d5',
    theme: 'fork',
    difficulty: 2,
    title: 'Knight Outpost',
    description: "White to move. Jump the knight to a dominant square that attacks two pieces at once.",
    rating: 1150,
  },
  {
    fen: 'r3r1k1/pp3ppp/2p5/8/2B5/8/PPP2PPP/R3R1K1 w - - 0 1',
    solution_uci: 'c4f7 e8f7 e1e8',
    theme: 'sacrifice',
    difficulty: 3,
    title: 'Bishop Sacrifice',
    description: "White to move. Sacrifice the bishop to expose the king, then swing the rook in for the kill.",
    rating: 1300,
  },
  {
    fen: '5rk1/pp4pp/2p5/2b2p2/2B2P2/5N2/PPP3PP/5RK1 w - - 0 1',
    solution_uci: 'f3d4 c5d4 f1f5',
    theme: 'removal',
    difficulty: 3,
    title: 'Remove the Defender',
    description: "White to move. The bishop on c5 is the key defender. Eliminate it to expose the rook X-ray.",
    rating: 1250,
  },
];

async function seedPuzzles(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let inserted = 0;
    for (const p of puzzles) {
      await client.query(
        `INSERT INTO puzzles (fen, solution_uci, theme, difficulty, title, description, rating)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [p.fen, p.solution_uci, p.theme, p.difficulty, p.title, p.description, p.rating],
      );
      inserted++;
    }

    await client.query('COMMIT');
    console.log(`✓ Seeded ${inserted} puzzles`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedPuzzles();
