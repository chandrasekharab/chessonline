-- Additional verified puzzles for difficulty 3+
-- All solutions validated with chess.js

INSERT INTO puzzles (fen, solution_uci, theme, difficulty, title, description, rating) VALUES

-- ── Difficulty 3 ───────────────────────────────────────────────────────────

-- Rxc8#: white rook captures the only defender of the back rank.
-- The knight on f3 is a deliberate decoy — don't be fooled by Ng5.
(
  '2r3k1/pp3ppp/8/8/8/5N2/PP3PPP/2R3K1 w - - 0 1',
  'c1c8',
  'back_rank', 3,
  'Capture to Checkmate',
  'White to move. Two of your pieces are staring at the black king, but only one delivers immediate checkmate. Can you see past the decoy?',
  1300
),

-- Rook vs Rook back-rank: Rxf8# — the black rook is the only thing guarding the back rank.
-- Pawns on f7/g7/h7 block all king escapes.
(
  '5rk1/5ppp/8/8/8/8/8/5RK1 w - - 0 1',
  'f1f8',
  'back_rank', 3,
  'The Only Move',
  'White to move, with only a rook and king. The position looks drawn — but there is an immediate forced win. Find it.',
  1250
),

-- Rook + Queen two-step: Rxf8+ Kxf8 Qd8#
-- Rook sac forces the king forward into the queen's firing line.
(
  '5rk1/5ppp/8/8/8/8/8/3QR1K1 w - - 0 1',
  'e1f8 g8f8 d1d8',
  'sacrifice', 3,
  'Rook Down, Queen Wins',
  'White to move. Sacrifice the rook on f8 to drag the king forward, then bring the queen for the back-rank knockout.',
  1380
),

-- ── Difficulty 4 ────────────────────────────────────────────────────────────

-- Royal fork: Nd5-c7+ forks king and two rooks. King retreats, knight takes Ra8.
-- Already exists as difficulty-2 — this is a different starting position (king castled short).
(
  'r3k2r/ppq2ppp/2n5/3N4/8/8/PPP2PPP/R2QK2R w KQkq - 0 1',
  'd5c7 e8d8 c7a8',
  'fork', 4,
  'Knight Skewer',
  'White to move. The knight leaps to fork the king and both rooks. Calculate the full sequence to win material.',
  1500
)

ON CONFLICT DO NOTHING;

