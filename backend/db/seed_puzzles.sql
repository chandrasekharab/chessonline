INSERT INTO puzzles (fen, solution_uci, theme, difficulty, title, description, rating) VALUES
(
  'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
  'h5f7',
  'mate_in_1', 1,
  'Scholar''s Mate',
  'White to move. The queen and bishop have been eyeing f7 all game. Finish it.',
  800
),
(
  'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2',
  'd8h4',
  'mate_in_1', 1,
  'Fool''s Mate',
  'Black to move. White has weakened their king fatally. Deliver the fastest checkmate in chess.',
  700
),
(
  '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
  'a1a8',
  'back_rank', 1,
  'Back Rank Mate',
  'White to move. Black''s king is trapped on the back rank with no escape. Find the checkmate.',
  900
),
(
  '6k1/2Q2ppp/8/8/8/8/5PPP/6K1 w - - 0 1',
  'c7g7',
  'mate_in_1', 1,
  'Queen Smothers King',
  'White to move. The queen has a decisive blow — Black''s own pawns seal the king''s fate.',
  850
),
(
  'r3k2r/pppp1ppp/8/3N4/8/8/PPPP1PPP/R3K2R w KQkq - 0 1',
  'd5c7 e8d8 c7a8',
  'fork', 2,
  'Royal Knight Fork',
  'White to move. A single knight leap attacks two major pieces simultaneously. Can you find it?',
  1100
),
(
  '6k1/5ppp/8/4q3/8/8/5PPP/4R1K1 w - - 0 1',
  'e1e5',
  'hanging_piece', 1,
  'Free Material',
  'White to move. A powerful piece stands completely undefended. Capture it.',
  750
)
ON CONFLICT DO NOTHING;
