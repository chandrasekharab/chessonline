import { Chess } from 'chess.js';
import { engineService } from './engine.service';
import { classifyMove, clampEval } from '../utils/classification';
import { MoveLabel } from '../types';

// ── Depth by difficulty (1 = easy / 5 = hard) ─────────────────────────────
const DEPTH_BY_DIFFICULTY: Record<number, number> = {
  1: 5, 2: 8, 3: 11, 4: 14, 5: 17,
};

function depthFor(difficulty: number): number {
  return DEPTH_BY_DIFFICULTY[Math.max(1, Math.min(5, difficulty))] ?? 11;
}

// ── Types ──────────────────────────────────────────────────────────────────
export interface TutorialMoveDetail {
  uci: string;
  san: string;
  label: MoveLabel;
  eval_before: number;
  eval_after: number;
  explanation: string;
}

export interface GameOverInfo {
  winner: 'white' | 'black' | 'draw';
  reason: string;
}

export interface TutorialMoveResponse {
  player_move: TutorialMoveDetail;
  engine_move: TutorialMoveDetail | null;
  fen_after_player: string;
  fen_after_engine: string;
  game_over: GameOverInfo | null;
}

export interface TutorialHintResponse {
  best_move_uci: string;
  best_move_san: string;
  explanation: string;
  eval_cp: number;
}

export interface TutorialFirstMoveResponse {
  uci: string;
  san: string;
  explanation: string;
  fen_after: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const PIECE_NAMES: Record<string, string> = {
  p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
};

function positionSummary(cp: number): string {
  const abs = Math.abs(cp);
  const side = cp >= 0 ? 'White' : 'Black';
  if (abs > 800) return `${side} is winning decisively`;
  if (abs > 400) return `${side} has a large advantage`;
  if (abs > 150) return `${side} is slightly better`;
  return 'The position is roughly equal';
}

function evalTag(cp: number): string {
  return `${positionSummary(cp)} (${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(1)})`;
}

type MoveKind = 'castle_ks' | 'castle_qs' | 'en_passant' | 'promotion' | 'capture' | 'check' | 'normal';

function detectKind(flags: string, san: string, isCheckAfter: boolean): MoveKind {
  if (flags.includes('k')) return 'castle_ks';
  if (flags.includes('q')) return 'castle_qs';
  if (flags.includes('e')) return 'en_passant';
  if (flags.includes('p') || san.includes('=')) return 'promotion';
  if (isCheckAfter) return 'check';
  if (flags.includes('c')) return 'capture';
  return 'normal';
}

function generateExplanation(opts: {
  label: MoveLabel;
  san: string;
  piece: string;
  kind: MoveKind;
  evalBefore: number;
  evalAfter: number;
  bestMoveSan: string;
  isPlayerMove: boolean;
  isWhiteMove: boolean;
}): string {
  const { label, san, piece, kind, evalBefore, evalAfter, bestMoveSan, isPlayerMove } = opts;
  const pieceName = PIECE_NAMES[piece] ?? 'piece';
  const diff = ((Math.abs(evalAfter - evalBefore)) / 100).toFixed(1);
  const parts: string[] = [];

  // ── Quality headline ────────────────────────────────────────────────────
  if (isPlayerMove) {
    switch (label) {
      case 'best':
        parts.push(`✦ Best move! ${san} is exactly what the engine would play here.`);
        break;
      case 'excellent':
        parts.push(`✓ Excellent ${pieceName} move! ${san} is even stronger than the first choice.`);
        break;
      case 'good':
        parts.push(`Good ${pieceName} move. ${san} maintains your position.`);
        break;
      case 'inaccuracy':
        parts.push(`⚠ Inaccuracy — ${san} gives away about ${diff} pawns of advantage.`);
        if (bestMoveSan && bestMoveSan !== san)
          parts.push(`${bestMoveSan} was the stronger option.`);
        break;
      case 'mistake':
        parts.push(`✗ Mistake! ${san} costs roughly ${diff} pawns.`);
        if (bestMoveSan && bestMoveSan !== san)
          parts.push(`In similar positions, consider ${bestMoveSan} instead.`);
        break;
      case 'blunder':
        parts.push(`✗✗ Blunder! ${san} is a serious error, giving away about ${diff} pawns.`);
        if (bestMoveSan && bestMoveSan !== san)
          parts.push(`The correct move was ${bestMoveSan}.`);
        break;
      case 'missed_win':
        parts.push(`⚠ Missed win! You had a decisive advantage but ${san} let it slip.`);
        if (bestMoveSan) parts.push(`${bestMoveSan} would have kept you winning.`);
        break;
    }
  } else {
    switch (label) {
      case 'best':
      case 'excellent':
        parts.push(`The engine finds ${san} — the most precise ${pieceName} move.`);
        break;
      default:
        parts.push(`The engine responds with ${san}.`);
    }
  }

  // ── Move-type educational tip ───────────────────────────────────────────
  switch (kind) {
    case 'castle_ks':
      parts.push(
        `Castling kingside (O-O) tucks the king safely behind the pawns and activates the rook on f1. ` +
        `This is often the most important defensive task in the opening.`
      );
      break;
    case 'castle_qs':
      parts.push(
        `Castling queenside (O-O-O) centralises the rook on d1, giving it immediate power — ` +
        `but the king on c1 needs the b- and c-pawns to stay intact as a shelter.`
      );
      break;
    case 'en_passant':
      parts.push(
        `En passant! This special pawn capture only occurs when an opponent pawn double-advances ` +
        `past your pawn. You must capture immediately or lose the opportunity forever.`
      );
      break;
    case 'promotion':
      parts.push(
        `Pawn promotion! Advancing a pawn to the last rank turns it into any piece — ` +
        `almost always a queen to maximise power. This often decides the game.`
      );
      break;
    case 'check':
      parts.push(
        `Check! The king is under direct attack and must move out of danger. ` +
        `Checks can force the opponent into defensive moves and gain tempo.`
      );
      break;
    case 'capture':
      parts.push(
        `A capture — make sure to count all recaptures carefully to confirm you come out ` +
        `ahead (or at least equal) on material after the exchange sequence.`
      );
      break;
    case 'normal':
      if (piece === 'n' || piece === 'b') {
        parts.push(
          `Developing the ${pieceName} is a key opening principle. ` +
          `Get your minor pieces off the back rank and pointing towards the centre before launching an attack.`
        );
      } else if (piece === 'p') {
        if (san[0] === 'e' || san[0] === 'd') {
          parts.push(
            `Central pawn moves claim space and open lines for the bishops and queen — ` +
            `the foundation of most opening strategies.`
          );
        } else {
          parts.push(
            `Pawn moves are permanent — unlike piece moves you cannot undo them, ` +
            `so make sure every pawn advance has a clear purpose.`
          );
        }
      } else if (piece === 'r') {
        parts.push(
          `Rooks thrive on open files (no pawns blocking). ` +
          `Centralising your rook doubles its influence and can penetrate to the 7th rank in the endgame.`
        );
      } else if (piece === 'q') {
        parts.push(
          `Be cautious about moving the queen early — it can be chased by opponent pieces, ` +
          `wasting valuable tempos that the opponent can use to develop.`
        );
      } else if (piece === 'k') {
        parts.push(
          `King moves voluntarily in the opening or middlegame are rare and often risky. ` +
          `Use them only when necessary — consider castling instead.`
        );
      }
      break;
  }

  // ── Position summary ────────────────────────────────────────────────────
  parts.push(evalTag(evalAfter) + '.');

  return parts.join(' ');
}

function checkGameOver(chess: Chess): GameOverInfo | null {
  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? 'black' : 'white';
    return { winner, reason: 'checkmate' };
  }
  if (chess.isStalemate()) return { winner: 'draw', reason: 'stalemate' };
  if (chess.isInsufficientMaterial()) return { winner: 'draw', reason: 'insufficient material' };
  if (chess.isThreefoldRepetition()) return { winner: 'draw', reason: 'threefold repetition' };
  if (chess.isDraw()) return { winner: 'draw', reason: 'fifty-move rule' };
  return null;
}

// ── Convert engine's bestMove UCI to SAN safely ────────────────────────────
function uciToSan(fen: string, uci: string): string {
  try {
    const ch = new Chess(fen);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = ch.move(uci as any);
    return m?.san ?? uci;
  } catch {
    return uci;
  }
}

// ── Main services ──────────────────────────────────────────────────────────

/**
 * Process a player's move: evaluate it, generate explanation,
 * let engine reply, evaluate that too, explain it.
 */
export async function processPlayerMove(
  fen: string,
  moveUci: string,
  _playerColor: 'white' | 'black',
  difficulty = 3,
): Promise<TutorialMoveResponse> {
  const depth = depthFor(difficulty);
  const chess = new Chess(fen);

  // Eval the position BEFORE the player's move (also gives us hint / best move)
  const evalBefore = await engineService.evaluate(fen, depth);
  const evalBeforeCp = clampEval(evalBefore.score);
  const bestMoveSan = uciToSan(fen, evalBefore.bestMove ?? '');

  // Apply the player's move
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const moveResult = chess.move(moveUci as any);
  if (!moveResult) throw new Error('Invalid move');

  const fenAfterPlayer = chess.fen();
  const isWhiteMove = moveResult.color === 'w';
  const isCheckAfterPlayer = chess.isCheck();
  const playerKind = detectKind(moveResult.flags, moveResult.san, isCheckAfterPlayer);

  // Eval AFTER player's move
  const evalAfterPlayer = await engineService.evaluate(fenAfterPlayer, depth);
  const evalAfterPlayerCp = clampEval(evalAfterPlayer.score);

  // Normalise to white's perspective for classification & display
  // (Stockfish score is side-to-move perspective; negate when it's just become their turn)
  const evalBeforeWhite = isWhiteMove ? evalBeforeCp : -evalBeforeCp;
  const evalAfterWhite = isWhiteMove ? -evalAfterPlayerCp : evalAfterPlayerCp;

  const playerLabel = classifyMove(evalBeforeWhite, evalAfterWhite, isWhiteMove);

  const playerMoveDetail: TutorialMoveDetail = {
    uci: moveUci,
    san: moveResult.san,
    label: playerLabel,
    eval_before: evalBeforeWhite,
    eval_after: evalAfterWhite,
    explanation: generateExplanation({
      label: playerLabel,
      san: moveResult.san,
      piece: moveResult.piece as string,
      kind: playerKind,
      evalBefore: evalBeforeWhite,
      evalAfter: evalAfterWhite,
      bestMoveSan,
      isPlayerMove: true,
      isWhiteMove,
    }),
  };

  // Check game over after player's move
  const goAfterPlayer = checkGameOver(chess);
  if (goAfterPlayer) {
    return {
      player_move: playerMoveDetail,
      engine_move: null,
      fen_after_player: fenAfterPlayer,
      fen_after_engine: fenAfterPlayer,
      game_over: goAfterPlayer,
    };
  }

  // Engine reply: bestMove was returned from evalAfterPlayer
  const engineUci = evalAfterPlayer.bestMove;
  if (!engineUci) {
    return {
      player_move: playerMoveDetail,
      engine_move: null,
      fen_after_player: fenAfterPlayer,
      fen_after_engine: fenAfterPlayer,
      game_over: null,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engineMoveResult = chess.move(engineUci as any);
  if (!engineMoveResult) {
    return {
      player_move: playerMoveDetail,
      engine_move: null,
      fen_after_player: fenAfterPlayer,
      fen_after_engine: fenAfterPlayer,
      game_over: null,
    };
  }

  const fenAfterEngine = chess.fen();
  const engineIsWhiteMove = engineMoveResult.color === 'w';
  const isCheckAfterEngine = chess.isCheck();
  const engineKind = detectKind(engineMoveResult.flags, engineMoveResult.san, isCheckAfterEngine);

  // Eval AFTER engine's move
  const evalAfterEngine = await engineService.evaluate(fenAfterEngine, depth);
  const evalAfterEngineCp = clampEval(evalAfterEngine.score);

  // Engine's eval_before from white perspective = evalAfterWhite (same position)
  const engineEvalBeforeWhite = evalAfterWhite;
  const engineEvalAfterWhite = engineIsWhiteMove ? -evalAfterEngineCp : evalAfterEngineCp;

  const engineLabel = classifyMove(engineEvalBeforeWhite, engineEvalAfterWhite, engineIsWhiteMove);

  const engineMoveDetail: TutorialMoveDetail = {
    uci: engineUci,
    san: engineMoveResult.san,
    label: engineLabel,
    eval_before: engineEvalBeforeWhite,
    eval_after: engineEvalAfterWhite,
    explanation: generateExplanation({
      label: engineLabel,
      san: engineMoveResult.san,
      piece: engineMoveResult.piece as string,
      kind: engineKind,
      evalBefore: engineEvalBeforeWhite,
      evalAfter: engineEvalAfterWhite,
      bestMoveSan: engineMoveResult.san,
      isPlayerMove: false,
      isWhiteMove: engineIsWhiteMove,
    }),
  };

  return {
    player_move: playerMoveDetail,
    engine_move: engineMoveDetail,
    fen_after_player: fenAfterPlayer,
    fen_after_engine: fenAfterEngine,
    game_over: checkGameOver(chess),
  };
}

/**
 * Get a hint for the current position.
 */
export async function getHint(
  fen: string,
  _playerColor: 'white' | 'black',
  difficulty = 3,
): Promise<TutorialHintResponse> {
  const depth = depthFor(difficulty);
  const evalResult = await engineService.evaluate(fen, depth);
  const chess = new Chess(fen);
  const isWhiteTurn = chess.turn() === 'w';
  const rawCp = clampEval(evalResult.score);
  const evalCpWhite = isWhiteTurn ? rawCp : -rawCp;

  const bestMoveSan = uciToSan(fen, evalResult.bestMove ?? '');

  const explanation = [
    `💡 Hint: Try ${bestMoveSan}.`,
    `This is the engine's top choice.`,
    evalTag(evalCpWhite) + '.',
  ].join(' ');

  return {
    best_move_uci: evalResult.bestMove ?? '',
    best_move_san: bestMoveSan,
    explanation,
    eval_cp: evalCpWhite,
  };
}

/**
 * Called when the player chooses to play as Black — engine makes the first move.
 */
export async function engineFirstMove(
  fen: string,
  difficulty = 3,
): Promise<TutorialFirstMoveResponse> {
  const depth = depthFor(difficulty);
  const evalResult = await engineService.evaluate(fen, depth);
  const chess = new Chess(fen);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const moveResult = chess.move(evalResult.bestMove as any);
  if (!moveResult) throw new Error('Engine produced an invalid first move');

  const explanation = [
    `The engine opens with ${moveResult.san}.`,
    `Controlling centre and developing pieces quickly are the most important opening goals.`,
    evalTag(0) + '.',
  ].join(' ');

  return {
    uci: evalResult.bestMove,
    san: moveResult.san,
    explanation,
    fen_after: chess.fen(),
  };
}
