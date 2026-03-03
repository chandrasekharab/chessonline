import { Chess } from 'chess.js';
import { GameMetadata, ParsedMove } from '../types';

export interface PgnParseResult {
  metadata: GameMetadata;
  moves: ParsedMove[];
  valid: boolean;
  error?: string;
}

/**
 * Parses a PGN string and extracts metadata and moves with FEN positions.
 */
export function parsePgn(pgn: string): PgnParseResult {
  const chess = new Chess();

  try {
    chess.loadPgn(pgn.trim());
  } catch (err) {
    return { metadata: {}, moves: [], valid: false, error: String(err) };
  }

  // Extract header metadata
  const headers = chess.header();
  const metadata: GameMetadata = {
    event: headers['Event'] || undefined,
    site: headers['Site'] || undefined,
    date: headers['Date'] || undefined,
    round: headers['Round'] || undefined,
    white: headers['White'] || undefined,
    black: headers['Black'] || undefined,
    result: headers['Result'] || undefined,
    whiteElo: headers['WhiteElo'] || undefined,
    blackElo: headers['BlackElo'] || undefined,
    timeControl: headers['TimeControl'] || undefined,
    eco: headers['ECO'] || undefined,
  };

  // Replay the game to get per-move FEN positions
  const history = chess.history({ verbose: true });
  const replayChess = new Chess();
  const moves: ParsedMove[] = [];

  for (let i = 0; i < history.length; i++) {
    const fenBefore = replayChess.fen();
    const move = history[i];
    replayChess.move(move);
    const fenAfter = replayChess.fen();

    moves.push({
      moveNumber: Math.floor(i / 2) + 1,
      move: move.san,
      fen: fenAfter,
      fenBefore,
    });
  }

  return { metadata, moves, valid: true };
}

/**
 * Validates a PGN string without fully parsing it.
 */
export function validatePgn(pgn: string): { valid: boolean; error?: string } {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn.trim());
    if (chess.history().length === 0) {
      return { valid: false, error: 'PGN contains no moves' };
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, error: String(err) };
  }
}

/**
 * Sanitise raw PGN text: strip BOM, normalise line endings.
 */
export function sanitisePgn(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}
