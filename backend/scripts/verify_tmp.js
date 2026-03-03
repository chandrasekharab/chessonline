const {Chess} = require('/app/node_modules/chess.js');

function uciToObj(uci) {
  return { from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] || undefined };
}

function v(label, fen, sol) {
  const c = new Chess(fen);
  for (const m of sol.split(' ')) {
    try {
      const r = c.move(uciToObj(m));
      if (!r) return label + ': INVALID(null) ' + m;
    } catch(e) { return label + ': ERROR ' + e.message + ' at ' + m; }
  }
  return label + ': ' + (c.isCheckmate() ? 'CHECKMATE OK' : 'NOT_MATE');
}

const tests = [
  // 1. Already confirmed back-rank
  ['c1c8 back_rank diff3', '2r3k1/pp3ppp/8/8/8/5N2/PP3PPP/2R3K1 w - - 0 1', 'c1c8'],

  // 2. Arabian Mate: Rg7-h7# (Rf covers h-file, Nf6 covers g8+h7 so king can't flee or take)
  //    Black king h8, White Rg7 Nf6 Kh1
  ['Arabian g7h7 diff3', '7k/6R1/5N2/8/8/8/8/7K w - - 0 1', 'g7h7'],

  // 3. Back-rank: Rf8# with Qa3 defending f8 + Nh6 covering f7
  //    Black Kg8 g7p h7p, White Qa3 Nh6 Rf1 Kg1
  ['Rf8# Qa3+Nh6 diff3', '6k1/6pp/7N/8/8/Q7/8/5RK1 w - - 0 1', 'f1f8'],

  // 4. 3-mover: Nxf7+ (knight from h6 captures f7 pawn, checks Kg8), forced Kf8, then Qd8#
  //    White Qd1 Re1 Nh6 Kg1. Black Kg8 pawns f7,g7,h7
  ['Nxf7+Kf8 Qd8# diff4', '6k1/5ppp/7N/8/8/8/8/3QR1K1 w - - 0 1', 'h6f7 g8f8 d1d8'],

  // 5. Smothered: Nxf7# (smother — black king h8 is surrounded by own Rg8+pawns g7,h7)
  //    White Qd1 Re1 Nh6 Kg1. Black Rg8 Kh8 pawns f7,g7,h7
  ['Smothered h6f7# diff4', '6rk/5ppp/7N/8/8/8/8/3QR1K1 w - - 0 1', 'h6f7'],

  // 6. Original diff-2 knight fork (already in DB, confirming still works)
  ['knight fork diff2 orig', 'r3k2r/pppp1ppp/8/3N4/8/8/PPPP1PPP/R3K2R w KQkq - 0 1', 'd5c7 e8d8 c7a8'],
];

tests.forEach(([label, fen, sol]) => {
  process.stdout.write(v(label, fen, sol) + '\n');
});
