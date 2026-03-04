/**
 * Explanation Repository
 *
 * Handles persistence for:
 *   • position_features (extracted signals, cached by position hash)
 *   • ai_explanations  (LLM output, cached by position_hash + rating_tier)
 *   • ai_game_summaries
 *   • user_mistake_patterns  (aggregated theme counts)
 *   • llm_token_log          (cost tracking)
 */

import { query, pool } from '../config/database';
import {
  PositionFeatures,
  PositionFeaturesRow,
  AiExplanationRow,
  AiGameSummaryRow,
  UserMistakePattern,
  MoveLabel,
  RatingTier,
  MistakeTheme,
} from '../types';

// ─── Position Features ────────────────────────────────────────────────────────

export class ExplanationRepository {

  /** Upsert extracted features for a position (cached by hash). */
  async upsertFeatures(
    positionHash: string,
    gameId: string,
    moveNumber: number,
    label: MoveLabel,
    features: PositionFeatures,
  ): Promise<void> {
    await query(
      `INSERT INTO position_features
         (position_hash, game_id, move_number, move, fen, label,
          eval_before, eval_after, eval_drop,
          material_balance, king_safety_status, center_control_status,
          hanging_pieces, tactical_threat_allowed, better_alternative,
          principal_variation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (position_hash) DO NOTHING`,
      [
        positionHash,
        gameId,
        moveNumber,
        features.move,
        features.fen,
        label,
        features.evaluation_before,
        features.evaluation_after,
        features.evaluation_drop,
        features.material_balance,
        features.king_safety_status,
        features.center_control_status,
        features.hanging_pieces,
        features.tactical_threat_allowed,
        features.better_alternative,
        features.principal_variation,
      ],
    );
  }

  async getFeaturesByHash(positionHash: string): Promise<PositionFeaturesRow | null> {
    const { rows } = await query<PositionFeaturesRow>(
      `SELECT * FROM position_features WHERE position_hash = $1 LIMIT 1`,
      [positionHash],
    );
    return rows[0] ?? null;
  }

  async getFeaturesByGame(gameId: string): Promise<PositionFeaturesRow[]> {
    const { rows } = await query<PositionFeaturesRow>(
      `SELECT * FROM position_features WHERE game_id = $1 ORDER BY move_number ASC`,
      [gameId],
    );
    return rows;
  }

  // ─── AI Explanations ────────────────────────────────────────────────────────

  /** Check cache: returns existing explanation if available. */
  async findExplanation(
    positionHash: string,
    ratingTier: RatingTier,
  ): Promise<AiExplanationRow | null> {
    const { rows } = await query<AiExplanationRow>(
      `SELECT * FROM ai_explanations
       WHERE position_hash = $1 AND rating_tier = $2
       LIMIT 1`,
      [positionHash, ratingTier],
    );
    return rows[0] ?? null;
  }

  /** Persist a new explanation. */
  async insertExplanation(params: {
    gameId: string;
    analysisId: string | null;
    positionHash: string;
    ratingTier: RatingTier;
    explanation: string;
    promptTokens: number;
    completionTokens: number;
    modelUsed: string;
  }): Promise<AiExplanationRow> {
    const { rows } = await query<AiExplanationRow>(
      `INSERT INTO ai_explanations
         (game_id, analysis_id, position_hash, rating_tier, explanation,
          prompt_tokens, completion_tokens, model_used)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (position_hash, rating_tier)
       DO UPDATE SET explanation = EXCLUDED.explanation,
                     prompt_tokens = EXCLUDED.prompt_tokens,
                     completion_tokens = EXCLUDED.completion_tokens,
                     model_used = EXCLUDED.model_used
       RETURNING *`,
      [
        params.gameId,
        params.analysisId,
        params.positionHash,
        params.ratingTier,
        params.explanation,
        params.promptTokens,
        params.completionTokens,
        params.modelUsed,
      ],
    );
    return rows[0]!;
  }

  async getExplanationsByGame(gameId: string): Promise<AiExplanationRow[]> {
    const { rows } = await query<AiExplanationRow>(
      `SELECT ae.*, pf.move_number, pf.move
       FROM ai_explanations ae
       JOIN position_features pf ON ae.position_hash = pf.position_hash
       WHERE ae.game_id = $1
       ORDER BY pf.move_number ASC`,
      [gameId],
    );
    return rows;
  }

  // ─── Game Summaries ─────────────────────────────────────────────────────────

  async findSummary(gameId: string): Promise<AiGameSummaryRow | null> {
    const { rows } = await query<AiGameSummaryRow>(
      `SELECT * FROM ai_game_summaries WHERE game_id = $1 LIMIT 1`,
      [gameId],
    );
    return rows[0] ?? null;
  }

  async upsertSummary(params: {
    gameId: string;
    topWeaknesses: string[];
    trainingFocus: string;
    tacticalErrorCount: number;
    positionalErrorCount: number;
    summaryText: string;
    promptTokens: number;
    completionTokens: number;
    modelUsed: string;
  }): Promise<AiGameSummaryRow> {
    const { rows } = await query<AiGameSummaryRow>(
      `INSERT INTO ai_game_summaries
         (game_id, top_weaknesses, training_focus,
          tactical_error_count, positional_error_count,
          summary_text, prompt_tokens, completion_tokens, model_used)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (game_id)
       DO UPDATE SET
         top_weaknesses       = EXCLUDED.top_weaknesses,
         training_focus       = EXCLUDED.training_focus,
         tactical_error_count = EXCLUDED.tactical_error_count,
         positional_error_count = EXCLUDED.positional_error_count,
         summary_text         = EXCLUDED.summary_text,
         prompt_tokens        = EXCLUDED.prompt_tokens,
         completion_tokens    = EXCLUDED.completion_tokens,
         model_used           = EXCLUDED.model_used,
         updated_at           = NOW()
       RETURNING *`,
      [
        params.gameId,
        params.topWeaknesses,
        params.trainingFocus,
        params.tacticalErrorCount,
        params.positionalErrorCount,
        params.summaryText,
        params.promptTokens,
        params.completionTokens,
        params.modelUsed,
      ],
    );
    return rows[0]!;
  }

  // ─── Mistake Patterns ───────────────────────────────────────────────────────

  /** Increment occurrence count for a theme, or insert if first occurrence. */
  async upsertMistakePattern(userId: string, theme: MistakeTheme): Promise<void> {
    await query(
      `INSERT INTO user_mistake_patterns (user_id, theme, occurrences, last_seen_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (user_id, theme)
       DO UPDATE SET
         occurrences  = user_mistake_patterns.occurrences + 1,
         last_seen_at = NOW()`,
      [userId, theme],
    );
  }

  async getMistakePatterns(userId: string): Promise<UserMistakePattern[]> {
    const { rows } = await query<UserMistakePattern>(
      `SELECT * FROM user_mistake_patterns
       WHERE user_id = $1
       ORDER BY occurrences DESC`,
      [userId],
    );
    return rows;
  }

  // ─── Token log ─────────────────────────────────────────────────────────────

  async logTokenUsage(params: {
    userId: string | null;
    gameId: string | null;
    operation: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
  }): Promise<void> {
    const total = params.promptTokens + params.completionTokens;
    await query(
      `INSERT INTO llm_token_log
         (user_id, game_id, operation, model, prompt_tokens, completion_tokens, total_tokens)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        params.userId,
        params.gameId,
        params.operation,
        params.model,
        params.promptTokens,
        params.completionTokens,
        total,
      ],
    );
  }

  /** Get per-user token usage totals. */
  async getUserTokenStats(userId: string): Promise<{
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
  }> {
    const { rows } = await query<{
      total_tokens: string;
      prompt_tokens: string;
      completion_tokens: string;
    }>(
      `SELECT
         COALESCE(SUM(total_tokens),0)      AS total_tokens,
         COALESCE(SUM(prompt_tokens),0)     AS prompt_tokens,
         COALESCE(SUM(completion_tokens),0) AS completion_tokens
       FROM llm_token_log
       WHERE user_id = $1`,
      [userId],
    );
    const row = rows[0]!;
    return {
      total_tokens: parseInt(row.total_tokens, 10),
      prompt_tokens: parseInt(row.prompt_tokens, 10),
      completion_tokens: parseInt(row.completion_tokens, 10),
    };
  }
}

export const explanationRepo = new ExplanationRepository();
