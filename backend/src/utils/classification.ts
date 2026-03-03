import { MoveLabel } from '../types';

/**
 * Thresholds (centipawns) for classification.
 * Evaluation is always from the perspective of the side TO MOVE.
 */
const BLUNDER_THRESHOLD = 200;
const MISTAKE_THRESHOLD = 100;
const INACCURACY_THRESHOLD = 50;
const MISSED_WIN_BEFORE = 500;
const MISSED_WIN_AFTER = 200;

/**
 * Classify a single move given the eval before and after.
 *
 * @param evalBefore  Centipawn score before the move (white perspective)
 * @param evalAfter   Centipawn score after the move (white perspective)
 * @param isWhiteMove Whether the moving side is White
 */
export function classifyMove(
  evalBefore: number,
  evalAfter: number,
  isWhiteMove: boolean
): MoveLabel {
  // Normalise so "drop" is always a positive number for a bad move.
  // For white: a drop in eval is bad.  For black: a rise in eval is bad.
  const scoreBefore = isWhiteMove ? evalBefore : -evalBefore;
  const scoreAfter = isWhiteMove ? evalAfter : -evalAfter;

  // Check missed winning opportunity
  if (scoreBefore >= MISSED_WIN_BEFORE && scoreAfter < MISSED_WIN_AFTER) {
    return 'missed_win';
  }

  const drop = scoreBefore - scoreAfter;

  if (drop >= BLUNDER_THRESHOLD) return 'blunder';
  if (drop >= MISTAKE_THRESHOLD) return 'mistake';
  if (drop >= INACCURACY_THRESHOLD) return 'inaccuracy';
  if (drop <= -INACCURACY_THRESHOLD) return 'excellent'; // significantly better than engine top choice
  return 'good';
}

/**
 * Convert a mate-in-N score to centipawns for classification purposes.
 * Mate = ±30000 cp (large but bounded).
 */
export function mateToCentipawns(mateIn: number): number {
  const sign = mateIn > 0 ? 1 : -1;
  return sign * (30000 - Math.abs(mateIn) * 10);
}

/**
 * Clamp evaluation to a sane display range.
 */
export function clampEval(cp: number): number {
  return Math.max(-1500, Math.min(1500, cp));
}

/**
 * Human-readable label string.
 */
export const LABEL_DISPLAY: Record<MoveLabel, string> = {
  best: 'Best',
  excellent: 'Excellent',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
  missed_win: 'Missed Win',
};
