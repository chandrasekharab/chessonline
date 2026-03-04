/**
 * AI Explanation Orchestrator
 *
 * Coordinates:
 *   1. Feature extraction from analysis row data
 *   2. Cache lookup (DB + optional Redis)
 *   3. LLM call (if cache miss)
 *   4. Persistence (explanation, token log, mistake patterns)
 *   5. Returns ExplainMoveResponse
 *
 * Called both from:
 *   • analysis.service.ts (batch, post-game, async)
 *   • explanation.controller.ts (on-demand, per user request)
 */

import { engineService } from './engine.service';
import { extractFeatures, positionHash, FeatureExtractionInput } from './featureExtraction.service';
import { generateMoveExplanation } from './explanation.service';
import { generateGameSummary, classifyThemes, CriticalMoveEntry, GameSummaryInput, GameSummaryResult } from './gameSummary.service';
import { explanationRepo } from '../repositories/explanation.repository';
import { AnalysisRepository } from '../repositories/analysis.repository';
import { UserRepository } from '../repositories/user.repository';
import { GameRepository } from '../repositories/game.repository';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import {
  PositionFeatures, MoveLabel, RatingTier, MistakeTheme,
  ExplainMoveResponse, GameSummaryResponse,
  getRatingTier,
} from '../types';

const analysisRepo   = new AnalysisRepository();
const userRepo       = new UserRepository();
const gameRepo       = new GameRepository();

/** Labels that warrant an explanation (skip for small inaccuracies). */
const EXPLANATION_LABELS: Set<MoveLabel> = new Set(['mistake', 'blunder', 'missed_win']);

function shouldExplain(label: MoveLabel, evalDrop: number): boolean {
  return (
    EXPLANATION_LABELS.has(label) ||
    evalDrop >= env.EXPLANATION_MIN_DROP_CP
  );
}

// ─── Single Move Explanation ──────────────────────────────────────────────────

export interface ExplainMoveOptions {
  gameId: string;
  moveNumber: number;
  userId: string;
}

/**
 * Explain a specific move in a game (on-demand, user-triggered).
 */
export async function explainMove(opts: ExplainMoveOptions): Promise<ExplainMoveResponse> {
  const { gameId, moveNumber, userId } = opts;

  // Fetch analysis row and user rating
  const [moves, user] = await Promise.all([
    analysisRepo.findByGame(gameId),
    userRepo.findById(userId),
  ]);

  const moveRow = moves.find((m) => m.move_number === moveNumber);
  if (!moveRow) throw new Error(`Move ${moveNumber} not found in game ${gameId}`);

  const ratingTier = getRatingTier(user?.rating ?? 1200);
  const label = moveRow.label;

  // We always explain on explicit user request, regardless of drop threshold
  const fenAfter = moveRow.fen;

  // Reconstruct fenBefore by replaying PGN up to previous move
  const fenBefore = moves.find((m) => m.move_number === moveNumber - 1)?.fen
    ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const isWhiteMove = moveNumber % 2 === 1; // odd move numbers = white (half-move)

  // Determine principal variation from engine
  let pv: string[] = [];
  let bestMoveSan = moveRow.best_move ?? '';
  try {
    const evalResult = await engineService.evaluate(fenBefore, env.ENGINE_DEPTH);
    bestMoveSan = evalResult.bestMove;
    pv = [evalResult.bestMove];
  } catch (err) {
    logger.warn('Could not get PV for explanation', { error: String(err) });
  }

  const featureInput: FeatureExtractionInput = {
    move: moveRow.move,
    fenBefore,
    fenAfter,
    evalBefore: moveRow.eval_before ?? 0,
    evalAfter:  moveRow.eval_after  ?? 0,
    label,
    bestMove: bestMoveSan,
    principalVariation: pv,
    isWhiteMove,
  };

  const features = extractFeatures(featureInput);
  const hash = positionHash(fenAfter, bestMoveSan);

  // Cache lookup
  const cached = await explanationRepo.findExplanation(hash, ratingTier);
  if (cached) {
    logger.info('Explanation cache hit', { hash, ratingTier });
    await explanationRepo.upsertFeatures(hash, gameId, moveNumber, label, features).catch(() => {});
    return {
      explanation: cached.explanation,
      features,
      cached: true,
      rating_tier: ratingTier,
      model_used: cached.model_used,
    };
  }

  // Cache miss → LLM call (graceful fallback if LLM unavailable)
  let result: { explanation: string; prompt_tokens: number; completion_tokens: number; model_used: string };
  try {
    result = await generateMoveExplanation(features, label, ratingTier);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('generateMoveExplanation failed, returning fallback', { error: errMsg });
    const labelDesc: Record<string, string> = {
      blunder: 'a blunder that likely loses significant material or evaluation',
      mistake: 'a mistake that misses a better continuation',
      missed_win: 'a missed winning opportunity',
      inaccuracy: 'a slight inaccuracy',
    };
    return {
      explanation: `AI coaching is unavailable right now (${errMsg}). This move was ${labelDesc[label] ?? 'notable'}. Load a model in LM Studio to get detailed coaching.`,
      features,
      cached: false,
      rating_tier: ratingTier,
      model_used: 'none',
    };
  }

  // Persist everything in parallel
  await Promise.all([
    explanationRepo.upsertFeatures(hash, gameId, moveNumber, label, features),
    explanationRepo.insertExplanation({
      gameId,
      analysisId: moveRow.id,
      positionHash: hash,
      ratingTier,
      explanation: result.explanation,
      promptTokens: result.prompt_tokens,
      completionTokens: result.completion_tokens,
      modelUsed: result.model_used,
    }),
    explanationRepo.logTokenUsage({
      userId,
      gameId,
      operation: 'explain_move',
      model: result.model_used,
      promptTokens: result.prompt_tokens,
      completionTokens: result.completion_tokens,
    }),
  ]);

  // Track mistake patterns asynchronously (non-blocking)
  const themes = classifyThemes(features, label, moveNumber);
  for (const theme of themes) {
    explanationRepo.upsertMistakePattern(userId, theme as MistakeTheme).catch(() => {});
  }

  return {
    explanation: result.explanation,
    features,
    cached: false,
    rating_tier: ratingTier,
    model_used: result.model_used,
  };
}

// ─── Game Summary (post-game batch) ────────────────────────────────────────────

export interface GenerateGameSummaryOptions {
  gameId: string;
  userId: string;
}

/**
 * Generate (or retrieve cached) AI post-game summary.
 */
export async function getOrGenerateGameSummary(
  opts: GenerateGameSummaryOptions,
): Promise<GameSummaryResponse> {
  const { gameId, userId } = opts;

  // Check cache
  const existing = await explanationRepo.findSummary(gameId);
  if (existing) {
    return {
      summary_text: existing.summary_text,
      top_weaknesses: existing.top_weaknesses,
      training_focus: existing.training_focus,
      tactical_error_count: existing.tactical_error_count,
      positional_error_count: existing.positional_error_count,
      cached: true,
      model_used: existing.model_used,
    };
  }

  const [moves, user] = await Promise.all([
    analysisRepo.findByGame(gameId),
    userRepo.findById(userId),
  ]);

  const ratingTier = getRatingTier(user?.rating ?? 1200);

  // Reconstruct critical moves with features
  const criticalMoves: CriticalMoveEntry[] = [];

  // Build a running FEN list (we need fenBefore for each move)
  const fens = [
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    ...moves.map((m) => m.fen),
  ];

  for (let i = 0; i < moves.length; i++) {
    const mv = moves[i]!;
    if (!shouldExplain(mv.label, Math.abs(mv.eval_diff ?? 0))) continue;

    const fenBefore = fens[i]!;
    const fenAfter  = mv.fen;
    const isWhiteMove = mv.move_number % 2 === 1;

    const featInput: FeatureExtractionInput = {
      move: mv.move,
      fenBefore,
      fenAfter,
      evalBefore: mv.eval_before ?? 0,
      evalAfter:  mv.eval_after  ?? 0,
      label: mv.label,
      bestMove: mv.best_move ?? mv.move,
      principalVariation: [],
      isWhiteMove,
    };

    const features = extractFeatures(featInput);
    const themes   = classifyThemes(features, mv.label, mv.move_number) as MistakeTheme[];

    criticalMoves.push({ features, label: mv.label, moveNumber: mv.move_number, themes });
  }

  // Determine player colour for prompt context
  const game = await gameRepo.findById(gameId);
  const playerColor: 'white' | 'black' | 'unknown' =
    game?.metadata_json?.white === user?.email ? 'white' :
    game?.metadata_json?.black === user?.email ? 'black' : 'unknown';

  const summaryInput: GameSummaryInput = {
    gameId,
    criticalMoves,
    ratingTier,
    playerColor,
  };

  const result = await generateGameSummary(summaryInput).catch((err) => {
    logger.error('generateGameSummary failed, returning stats-only summary', { error: String(err) });
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      summary_text: `AI coaching unavailable: ${errMsg}`,
      top_weaknesses: [],
      training_focus: 'Load a model in LM Studio to get AI coaching.',
      tactical_error_count: criticalMoves.filter(m => m.themes.includes('tactics' as MistakeTheme) || m.themes.includes('hanging_pieces' as MistakeTheme)).length,
      positional_error_count: criticalMoves.filter(m => !m.themes.includes('tactics' as MistakeTheme) && !m.themes.includes('hanging_pieces' as MistakeTheme)).length,
      prompt_tokens: 0,
      completion_tokens: 0,
      model_used: 'none',
      theme_counts: {} as Partial<Record<MistakeTheme, number>>,
    } satisfies GameSummaryResult;
  });

  // Persist
  const saved = await explanationRepo.upsertSummary({
    gameId,
    topWeaknesses: result.top_weaknesses,
    trainingFocus: result.training_focus,
    tacticalErrorCount: result.tactical_error_count,
    positionalErrorCount: result.positional_error_count,
    summaryText: result.summary_text,
    promptTokens: result.prompt_tokens,
    completionTokens: result.completion_tokens,
    modelUsed: result.model_used,
  });

  // Log tokens
  explanationRepo.logTokenUsage({
    userId,
    gameId,
    operation: 'game_summary',
    model: result.model_used,
    promptTokens: result.prompt_tokens,
    completionTokens: result.completion_tokens,
  }).catch(() => {});

  // Update mistake patterns for all critical moves
  for (const entry of criticalMoves) {
    for (const theme of entry.themes) {
      explanationRepo.upsertMistakePattern(userId, theme).catch(() => {});
    }
  }

  return {
    summary_text: result.summary_text,
    top_weaknesses: result.top_weaknesses,
    training_focus: result.training_focus,
    tactical_error_count: result.tactical_error_count,
    positional_error_count: result.positional_error_count,
    cached: false,
    model_used: result.model_used,
  };
}

/**
 * Batch post-game explanation generation called from analysis pipeline.
 * Only generates for mistakes/blunders — skips inaccuracies to save tokens.
 */
export async function batchGenerateExplanations(
  gameId: string,
  userId: string,
): Promise<void> {
  logger.info('Starting batch explanation generation', { gameId });

  const [moves, user] = await Promise.all([
    analysisRepo.findByGame(gameId),
    userRepo.findById(userId),
  ]);

  const ratingTier = getRatingTier(user?.rating ?? 1200);
  const fens = [
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    ...moves.map((m) => m.fen),
  ];

  let generated = 0;

  for (let i = 0; i < moves.length; i++) {
    const mv = moves[i]!;
    if (!shouldExplain(mv.label, Math.abs(mv.eval_diff ?? 0))) continue;

    const fenBefore = fens[i]!;
    const fenAfter  = mv.fen;
    const isWhiteMove = mv.move_number % 2 === 1;
    const bestMove = mv.best_move ?? mv.move;

    const hash = positionHash(fenAfter, bestMove);

    // Skip if already cached for this tier
    const existing = await explanationRepo.findExplanation(hash, ratingTier);
    if (existing) continue;

    const featureInput: FeatureExtractionInput = {
      move: mv.move,
      fenBefore,
      fenAfter,
      evalBefore: mv.eval_before ?? 0,
      evalAfter:  mv.eval_after  ?? 0,
      label: mv.label,
      bestMove,
      principalVariation: [],
      isWhiteMove,
    };

    const features = extractFeatures(featureInput);

    try {
      const result = await generateMoveExplanation(features, mv.label, ratingTier);

      await Promise.all([
        explanationRepo.upsertFeatures(hash, gameId, mv.move_number, mv.label, features),
        explanationRepo.insertExplanation({
          gameId,
          analysisId: mv.id,
          positionHash: hash,
          ratingTier,
          explanation: result.explanation,
          promptTokens: result.prompt_tokens,
          completionTokens: result.completion_tokens,
          modelUsed: result.model_used,
        }),
        explanationRepo.logTokenUsage({
          userId,
          gameId,
          operation: 'explain_move',
          model: result.model_used,
          promptTokens: result.prompt_tokens,
          completionTokens: result.completion_tokens,
        }),
      ]);

      generated++;
    } catch (err) {
      logger.error('Batch explanation failed for move', { moveNumber: mv.move_number, error: String(err) });
    }
  }

  logger.info('Batch explanation generation complete', { gameId, generated });
}
