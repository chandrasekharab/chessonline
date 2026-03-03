/**
 * Seed script — creates sample users and uploads games for each.
 *
 * Usage (inside the running backend container):
 *   npx ts-node scripts/seed.ts
 *
 * Or run against the live API from your host machine:
 *   DATABASE_URL=... SEED_VIA_API=true BASE_URL=http://localhost:8000 npx ts-node scripts/seed.ts
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

// ─── Sample PGN games ─────────────────────────────────────────────────────────

const GAMES: Array<{ title: string; pgn: string }> = [
  {
    title: "The Immortal Game — Anderssen vs Kieseritzky (1851)",
    pgn: `[Event "London casual game"]
[Site "London ENG"]
[Date "1851.06.21"]
[White "Adolf Anderssen"]
[Black "Lionel Kieseritzky"]
[Result "1-0"]
[ECO "C33"]

1.e4 e5 2.f4 exf4 3.Bc4 Qh4+ 4.Kf1 b5 5.Bxb5 Nf6 6.Nf3 Qh6 7.d3 Nh5
8.Nh4 Qg5 9.Nf5 c6 10.g4 Nf6 11.Rg1 cxb5 12.h4 Qg6 13.h5 Qg5 14.Qf3 Ng8
15.Bxf4 Qf6 16.Nc3 Bc5 17.Nd5 Qxb2 18.Bd6 Bxg1 19.e5 Qxa1+ 20.Ke2 Na6
21.Nxg7+ Kd8 22.Qf6+ Nxf6 23.Be7# 1-0`,
  },
  {
    title: "The Opera Game — Morphy vs Duke of Brunswick (1858)",
    pgn: `[Event "Paris opera game"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[White "Paul Morphy"]
[Black "Duke of Brunswick & Count Isouard"]
[Result "1-0"]
[ECO "C41"]

1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7
8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7
14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8# 1-0`,
  },
  {
    title: "The Evergreen Game — Anderssen vs Dufresne (1852)",
    pgn: `[Event "Casual game"]
[Site "Berlin GER"]
[Date "1852.??.??"]
[White "Adolf Anderssen"]
[Black "Jean Dufresne"]
[Result "1-0"]
[ECO "C52"]

1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4 5.c3 Ba5 6.d4 exd4 7.O-O d3
8.Qb3 Qf6 9.e5 Qg6 10.Re1 Nge7 11.Ba3 b5 12.Qxb5 Rb8 13.Qa4 Bb6 14.Nbd2
Bb7 15.Ne4 Qf5 16.Bxd3 Qh5 17.Nf6+ gxf6 18.exf6 Rg8 19.Rad1 Qxf3
20.Rxe7+ Nxe7 21.Qxd7+ Kxd7 22.Bf5+ Ke8 23.Bd7+ Kf8 24.Bxe7# 1-0`,
  },
  {
    title: "Game of the Century — Byrne vs Fischer (1956)",
    pgn: `[Event "Rosenwald Memorial"]
[Site "New York USA"]
[Date "1956.10.17"]
[White "Donald Byrne"]
[Black "Robert James Fischer"]
[Result "0-1"]
[WhiteElo "?"]
[BlackElo "?"]
[ECO "D92"]

1.Nf3 Nf6 2.c4 g6 3.Nc3 Bg7 4.d4 O-O 5.Bf4 d5 6.Qb3 dxc4 7.Qxc4 c6
8.e4 Nbd7 9.Rd1 Nb6 10.Qc5 Bg4 11.Bg5 Na4 12.Qa3 Nxc3 13.bxc3 Nxe4
14.Bxe7 Qb6 15.Bc4 Nxc3 16.Bc5 Rfe8+ 17.Kf1 Be6 18.Bxb6 Bxc4+ 19.Kg1
Ne2+ 20.Kf1 Nxd4+ 21.Kg1 Ne2+ 22.Kf1 Nc3+ 23.Kg1 axb6 24.Qb4 Ra4 25.Qxb6
Nxd1 26.h3 Rxa2 27.Kh2 Nxf2 28.Re1 Rxe1 29.Qd8+ Bf8 30.Nxe1 Bd5 31.Nf3
Ne4 32.Qb8 b5 33.h4 h5 34.Ne5 Kg7 35.Kg1 Bc5+ 36.Kf1 Ng3+ 37.Ke1 Bb4+
38.Kd1 Bb3+ 39.Kc1 Ne2+ 40.Kb1 Nc3+ 41.Kc1 Rc2# 0-1`,
  },
  {
    title: "Kasparov vs Topalov — Wijk aan Zee (1999)",
    pgn: `[Event "Hoogovens"]
[Site "Wijk aan Zee NED"]
[Date "1999.01.20"]
[White "Garry Kasparov"]
[Black "Veselin Topalov"]
[Result "1-0"]
[WhiteElo "2812"]
[BlackElo "2700"]
[ECO "B07"]

1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.Be3 Bg7 5.Qd2 c6 6.f3 b5 7.Nge2 Nbd7 8.Bh6
Bxh6 9.Qxh6 Bb7 10.a3 e5 11.O-O-O Qe7 12.Kb1 a6 13.Nc1 O-O-O 14.Nb3 exd4
15.Rxd4 c5 16.Rd1 Nb6 17.g3 Kb8 18.Na5 Ba8 19.Bh3 d5 20.Qf4+ Ka7 21.Rhe1
d4 22.Nd5 Nbxd5 23.exd5 Qd6 24.Rxd4 cxd4 25.Re7+ Kb6 26.Qxd4+ Kxa5 27.b4+
Ka4 28.Qc3 Qxd5 29.Ra7 Bb7 30.Rxb7 Qc4 31.Qxf6 Kxa3 32.Qxa6+ Kxb4 33.c3+
Kxc3 34.Qa1+ Kd2 35.Qb2+ Kd1 36.Bf1 Rd2 37.Rd7 Rxd7 38.Bxc4 bxc4 39.Qxh8
Rd3 40.Qa8 c3 41.Qa4+ Ke1 42.f4 f5 43.Kc1 Rd2 44.Qa7 1-0`,
  },
  {
    title: "Fischer vs Spassky — Game 6, World Championship (1972)",
    pgn: `[Event "World Championship Match"]
[Site "Reykjavik ISL"]
[Date "1972.07.23"]
[Round "6"]
[White "Robert James Fischer"]
[Black "Boris Spassky"]
[Result "1-0"]
[ECO "D59"]

1.c4 e6 2.Nf3 d5 3.d4 Nf6 4.Nc3 Be7 5.Bg5 O-O 6.e3 h6 7.Bh4 b6 8.cxd5
Nxd5 9.Bxe7 Qxe7 10.Nxd5 exd5 11.Rc1 Be6 12.Qa4 c5 13.Qa3 Rc8 14.Bb5 a6
15.dxc5 bxc5 16.O-O Ra7 17.Be2 Nd7 18.Nd4 Qf8 19.Nxe6 fxe6 20.e4 d4 21.f4
Qe7 22.e5 Rb8 23.Bc4 Kh8 24.Qh3 Nf8 25.b3 a5 26.f5 exf5 27.Rxf5 Nh7
28.Rcf1 Qd8 29.Qg3 Re7 30.h4 Rbb7 31.e6 Rbc7 32.Qe5 Qe8 33.a4 Qd8 34.R1f2
Qe8 35.R2f3 Qd8 36.Bd3 Qe8 37.Qe4 Nf6 38.Rxf6 gxf6 39.Rxf6 Kg8 40.Bc4 Kh8
41.Qf4 1-0`,
  },
  {
    title: "Deep Blue vs Kasparov — Game 2 (1997)",
    pgn: `[Event "IBM Kasparov vs. Deep Blue Rematch"]
[Site "New York, NY USA"]
[Date "1997.05.04"]
[Round "2"]
[White "Deep Blue"]
[Black "Garry Kasparov"]
[Result "1-0"]
[WhiteElo "?"]
[BlackElo "2795"]
[ECO "C93"]

1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3
O-O 9.h3 h6 10.d4 Re8 11.Nbd2 Bf8 12.Nf1 Bd7 13.Ng3 Na5 14.Bc2 c5 15.b3
Nc6 16.d5 Ne7 17.Be3 Ng6 18.Qd2 Nh7 19.a4 Nh4 20.Nxh4 Qxh4 21.Qe2 Qd8
22.b4 Qc7 23.Rec1 c4 24.Ra3 Rec8 25.Rca1 Qd8 26.f4 Nf6 27.fxe5 dxe5
28.Rxf6 gxf6 29.Rxf6 Kg7 30.Qxe5 Bf8 31.Rxf8 Rxf8 32.Bc2 Bf5 33.exf5 Rxc3
34.d6 Qb6 35.Bxc4 bxc4+ 36.Qxc4+ Rxc4 37.d7 Rc5 38.d8=Q Rxd8 39.Bxd8 Rd5
40.Bc7 Qd4 41.Be5+ Rxe5 42.Qxe5+ Kh7 1-0`,
  },
  {
    title: "Tal vs Botvinnik — World Championship Game 6 (1960)",
    pgn: `[Event "World Championship Match"]
[Site "Moscow USSR"]
[Date "1960.03.22"]
[Round "6"]
[White "Mikhail Tal"]
[Black "Mikhail Botvinnik"]
[Result "1-0"]
[ECO "E69"]

1.c4 Nf6 2.Nf3 g6 3.g3 Bg7 4.Bg2 O-O 5.d4 d6 6.Nc3 Nbd7 7.O-O e5
8.e4 c6 9.h3 Qb6 10.d5 cxd5 11.cxd5 Nc5 12.Ne1 Bd7 13.Nd3 Nxd3 14.Qxd3
Rfc8 15.Rb1 Nh5 16.Be3 Qb4 17.Qd2 a5 18.b3 Qxd2 19.Bxd2 b5 20.Nxb5 Bxb5
21.Rxb5 Rc2 22.Bd1 Rc8 23.Bxa5 Ra2 24.Bb4 Nf4 25.a4 h5 26.Rxb7 h4
27.gxh4 Nh3+ 28.Bxh3 Rxf2 29.Rxf2 Bxf2+ 30.Kxf2 Rc2+ 31.Ke3 Rxh2 32.Bb5
Rxh3+ 33.Kf2 Rh2+ 34.Ke3 Rh3+ 35.Kf2 Rh2+ 36.Ke3 Rxh4 37.a5 Rh3+ 38.Kf2
Rh2+ 39.Kg1 Ra2 40.Rb8 Kh7 41.a6 g5 42.Bc3 f6 43.Rxd8 Rxa6 44.Rh8+ Kg6
45.Rxh5 1-0`,
  },
  {
    title: "Aronian vs Anand — Wijk aan Zee (2013)",
    pgn: `[Event "Tata Steel Chess"]
    [Site "Wijk aan Zee NED"]
[Date "2013.01.13"]
[White "Levon Aronian"]
[Black "Viswanathan Anand"]
[Result "1-0"]
[WhiteElo "2802"]
[BlackElo "2772"]
[ECO "D47"]

1.d4 d5 2.c4 c6 3.Nc3 Nf6 4.e3 e6 5.Nf3 a6 6.b3 Bb4 7.Bd2 Nbd7 8.Bd3
O-O 9.O-O Bd6 10.Qc2 e5 11.cxd5 cxd5 12.e4 exd4 13.Nxd5 Nxd5 14.exd5 Nf6
15.h3 Bg4 16.Bxh7+ Nxh7 17.Nxd4 Qd7 18.Nf5 Bxf5 19.Qxf5 Nf6 20.Bg5 Rfe8
21.Rae1 Rxe1 22.Rxe1 Re8 23.Rxe8+ Qxe8 24.d6 Qd7 25.Bxf6 gxf6 26.Qxf6 Qg4
27.Qf3 Qxf3 28.gxf3 b5 29.Kf1 Kf8 30.Ke2 Ke8 31.Kd3 Kd7 32.Kc3 Bc5 33.b4
Bb6 34.a4 bxa4 35.b5 axb5 36.Kc4 Ke6 37.Kxb5 f5 38.Kxa4 f4 39.Ka5 Kxd6
40.Kb5 Kd5 41.f3+ 1-0`,
  },
  {
    title: "Scholar's Mate — Classic blunder trap",
    pgn: `[Event "Casual game"]
[Site "?"]
[Date "2024.01.01"]
[White "Player A"]
[Black "Player B"]
[Result "1-0"]

1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 4.Qxf7# 1-0`,
  },
];

// ─── Sample users ─────────────────────────────────────────────────────────────

const USERS = [
  {
    email: "alice@chess.dev",
    password: "ChessAlice2024!",
    games: [GAMES[0], GAMES[2], GAMES[4], GAMES[9]], // Immortal, Evergreen, Kasparov-Topalov, Scholar's Mate
  },
  {
    email: "bob@chess.dev",
    password: "ChessBob2024!",
    games: [GAMES[1], GAMES[3], GAMES[5], GAMES[6]], // Opera, Game of the Century, Fischer-Spassky, Deep Blue
  },
  {
    email: "admin@chess.dev",
    password: "ChessAdmin2024!",
    games: [GAMES[0], GAMES[1], GAMES[2], GAMES[3], GAMES[4], GAMES[5], GAMES[6], GAMES[7], GAMES[8]], // All classics
  },
];

// ─── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  console.log('\n🌱 Chess Insight Engine — Database Seeder\n');
  console.log(`Connecting to: ${process.env.DATABASE_URL?.replace(/:\/\/.*@/, '://***@')}\n`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const u of USERS) {
      // Upsert user (skip if email already exists)
      const existing = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [u.email]
      );

      let userId: string;
      if (existing.rows.length > 0) {
        userId = existing.rows[0].id as string;
        console.log(`  ⚠  User already exists: ${u.email}  (id: ${userId})`);
        // Reset any stuck/failed games so they can be re-analysed
        const reset = await client.query(
          `UPDATE games SET status = 'uploaded', progress_current = 0, progress_total = 0, updated_at = NOW()
           WHERE user_id = $1 AND status IN ('analyzing', 'failed')
           RETURNING id`,
          [userId]
        );
        if (reset.rowCount && reset.rowCount > 0) {
          console.log(`     ♻  Reset ${reset.rowCount} stuck game(s) to 'uploaded'`);
        }
      } else {
        const hash = await bcrypt.hash(u.password, 12);
        const res = await client.query(
          `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
          [u.email, hash]
        );
        userId = res.rows[0].id as string;
        console.log(`  ✅ Created user: ${u.email}  (id: ${userId})`);
        console.log(`     password: ${u.password}`);
      }

      // Insert games for this user
      for (const g of u.games) {
        const metaMatch = g.pgn.match(/\[Event "(.+)"\]/);
        const event = metaMatch?.[1] ?? g.title;

        const metadata = {
          event,
          white: (g.pgn.match(/\[White "(.+)"\]/) || [])[1],
          black: (g.pgn.match(/\[Black "(.+)"\]/) || [])[1],
          date:  (g.pgn.match(/\[Date "(.+)"\]/)  || [])[1],
          result:(g.pgn.match(/\[Result "(.+)"\]/) || [])[1],
          eco:   (g.pgn.match(/\[ECO "(.+)"\]/)   || [])[1],
        };

        // Avoid duplicate PGN for same user
        const dup = await client.query(
          'SELECT id FROM games WHERE user_id = $1 AND pgn = $2',
          [userId, g.pgn]
        );
        if (dup.rows.length > 0) {
          console.log(`     ↩  Game already seeded: "${g.title}"`);
          continue;
        }

        const gr = await client.query(
          `INSERT INTO games (user_id, pgn, metadata_json, status)
           VALUES ($1, $2, $3, 'uploaded') RETURNING id`,
          [userId, g.pgn, JSON.stringify(metadata)]
        );
        console.log(`     🎲 Inserted game: "${g.title}"  (id: ${gr.rows[0].id})`);
      }
      console.log();
    }

    await client.query('COMMIT');

    console.log('─'.repeat(60));
    console.log('✅ Seed complete!\n');
    console.log('Sample credentials:');
    for (const u of USERS) {
      console.log(`  ${u.email.padEnd(24)} / ${u.password}`);
    }
    console.log('\nLog in at http://localhost:8001');
    console.log('');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
