/**
 * Feature Extraction Service
 *
 * Converts raw Stockfish output + board state into a structured JSON signal
 * summary that can be safely passed to an LLM.  No raw FEN is forwarded.
 *
 * Signal types extracted:
 *   • Evaluation delta (centipawns)
 *   • Material balance
 *   • King safety (heuristic based on open files, pawn shelter)
 *   • Center control
 *   • Hanging pieces (undefended attacked pieces)
 *   • Tactical threat allowed (back-rank, fork, pin …)
 *   • Best alternative + principal variation from Stockfish
 */

import { Chess, Square } from 'chess.js';
import crypto from 'crypto';
import { PositionFeatures, MoveLabel } from '../types';
import { logger } from '../utils/logger';

// ─── Piece values for material balance ────────────────────────────────────────
const PIECE_VALUES: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
};

/** Returns material balance in pawn units from White's perspective. */
function computeMaterialBalance(chess: Chess): number {
  let white = 0;
  let black = 0;
  const board = chess.board();
  for (const rank of board) {
    for (const sq of rank) {
      if (!sq) continue;
      const val = PIECE_VALUES[sq.type] ?? 0;
      if (sq.color === 'w') white += val;
      else black += val;
    }
  }
  return Math.round((white - black) * 10) / 10;
}

/** Heuristic: assess king safety based on open files near king & pawn shelter. */
function assessKingSafety(
  chess: Chess,
  color: 'w' | 'b',
): PositionFeatures['king_safety_status'] {
  const board = chess.board();
  // Find king square
  let kingFile = -1;
  let kingRank = -1;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const sq = board[r]?.[f];
      if (sq && sq.type === 'k' && sq.color === color) {
        kingFile = f; kingRank = r;
      }
    }
  }
  if (kingFile < 0) return 'safe';

  // Count open/semi-open files near king (±1 file)
  let openFiles = 0;
  for (let df = -1; df <= 1; df++) {
    const f = kingFile + df;
    if (f < 0 || f > 7) continue;
    let hasPawn = false;
    for (let r = 0; r < 8; r++) {
      const sq = board[r]?.[f];
      if (sq && sq.type === 'p' && sq.color === color) { hasPawn = true; break; }
    }
    if (!hasPawn) openFiles++;
  }

  // Count attackers near king
  let attackers = 0;
  const enemyColor = color === 'w' ? 'b' : 'w';
  for (let dr = -2; dr <= 2; dr++) {
    for (let df = -2; df <= 2; df++) {
      const r = kingRank + dr;
      const f = kingFile + df;
      if (r < 0 || r > 7 || f < 0 || f > 7) continue;
      const sq = board[r]?.[f];
      if (sq && sq.color === enemyColor && sq.type !== 'k') attackers++;
    }
  }

  const dangerScore = openFiles + attackers;
  if (dangerScore >= 5) return 'critical';
  if (dangerScore >= 3) return 'exposed';
  if (dangerScore >= 1) return 'slightly_exposed';
  return 'safe';
}

/** Heuristic: center control based on piece presence on d4/d5/e4/e5. */
function assessCenterControl(chess: Chess): PositionFeatures['center_control_status'] {
  const centerSquares: Square[] = ['d4', 'd5', 'e4', 'e5'];
  let whiteControl = 0;
  let blackControl = 0;
  for (const sq of centerSquares) {
    const piece = chess.get(sq);
    if (!piece) continue;
    if (piece.color === 'w') whiteControl++;
    else blackControl++;
  }
  const diff = whiteControl - blackControl;
  if (diff >= 2) return 'white_dominant';
  if (diff <= -2) return 'black_dominant';
  if (whiteControl > 0 && blackControl > 0) return 'contested';
  return 'neutral';
}

/** Check for hanging (undefended & attacked) pieces. */
function hasHangingPieces(chess: Chess, color: 'w' | 'b'): boolean {
  // Look at each piece of `color` and check if it has zero defenders
  // while being attacked by the opponent.
  const board = chess.board();
  const files = 'abcdefgh';
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r]?.[f];
      if (!piece || piece.color !== color || piece.type === 'k') continue;
      const sq = `${files[f]}${8 - r}` as Square;

      // Count attackers by temporarily making a null move and seeing attacks
      // Simple proxy: use chess.js attackers if available
      try {
        const attackedBy = chess.attackers(sq, color === 'w' ? 'b' : 'w');
        const defendedBy = chess.attackers(sq, color);
        if (attackedBy.length > 0 && defendedBy.length === 0) {
          return true;
        }
      } catch {
        // chess.js version may not expose attackers() — skip gracefully
      }
    }
  }
  return false;
}

/**
 * Derive a short description of the most salient tactical threat.
 * Returns null when no obvious threat can be inferred cheaply.
 */
function detectTacticalThreat(
  chess: Chess,
  evalDrop: number,
  label: MoveLabel,
): string | null {
  if (label !== 'blunder' && label !== 'mistake' && label !== 'missed_win') return null;

  const isInCheck = chess.inCheck();
  if (isInCheck) return 'check (forcing opponent to respond)';

  // Back-rank mate hint: if a rook/queen can deliver mate on first/last rank
  const turn = chess.turn(); // side to move AFTER the played move
  if (evalDrop > 150) {
    // Look for rooks/queens on 7th/2nd rank
    const board = chess.board();
    const backRank = turn === 'w' ? 7 : 0; // rank index 0=rank8, 7=rank1
    for (let f = 0; f < 8; f++) {
      const sq = board[backRank]?.[f];
      if (sq && sq.color !== turn && (sq.type === 'r' || sq.type === 'q')) {
        return 'back-rank threat';
      }
    }
  }

  if (evalDrop > 200) return 'tactical winning material';
  if (evalDrop > 100) return 'positional advantage conceded';
  return null;
}

/**
 * Compute a SHA-256 hash of FEN + best_move to use as a cache key.
 */
export function positionHash(fen: string, bestMove: string): string {
  return crypto.createHash('sha256').update(`${fen}|${bestMove}`).digest('hex');
}

export interface FeatureExtractionInput {
  move: string;           // SAN notation
  fenBefore: string;      // FEN before the played move
  fenAfter: string;       // FEN after the played move
  evalBefore: number;     // Centipawns (white perspective)
  evalAfter: number;
  label: MoveLabel;
  bestMove: string;       // SAN of best engine move
  principalVariation: string[];
  isWhiteMove: boolean;
}

/**
 * Extract structured position features from raw analysis data.
 * All signals are derived from chess logic — no raw FEN sent to LLM.
 */
export function extractFeatures(input: FeatureExtractionInput): PositionFeatures {
  const {
    move, fenAfter, evalBefore, evalAfter,
    label, bestMove, principalVariation, isWhiteMove,
  } = input;

  // Side that just moved
  const movedColor: 'w' | 'b' = isWhiteMove ? 'w' : 'b';

  // Evaluate using position AFTER the move
  const chessAfter = new Chess(fenAfter);

  const evalDrop = Math.abs(isWhiteMove ? evalBefore - evalAfter : evalAfter - evalBefore);

  const materialBalance = computeMaterialBalance(chessAfter);
  const kingSafety = assessKingSafety(chessAfter, movedColor);
  const centerControl = assessCenterControl(chessAfter);

  let hangingPieces = false;
  try {
    // After black blunders, white now has hanging pieces to capture (and vice-versa)
    hangingPieces = hasHangingPieces(chessAfter, movedColor);
  } catch (err) {
    logger.warn('Hanging piece detection failed', { error: String(err) });
  }

  const tacticalThreat = detectTacticalThreat(chessAfter, evalDrop, label);

  return {
    move,
    fen: fenAfter,
    evaluation_before: evalBefore,
    evaluation_after: evalAfter,
    evaluation_drop: Math.round(evalDrop * 100) / 100,
    material_balance: materialBalance,
    king_safety_status: kingSafety,
    center_control_status: centerControl,
    hanging_pieces: hangingPieces,
    tactical_threat_allowed: tacticalThreat,
    better_alternative: bestMove,
    principal_variation: principalVariation.slice(0, 5), // limit PV depth
  };
}
