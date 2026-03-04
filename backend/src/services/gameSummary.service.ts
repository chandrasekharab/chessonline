/**
 * Game Summary Service
 *
 * Produces an AI-generated post-game summary:
 *   • Clusters mistakes by theme (king safety, tactics, endgame, …)
 *   • Identifies top 3 recurring weaknesses
 *   • Suggests training focus
 *   • Computes tactical vs positional error ratio
 *
 * Called automatically after analysis completes (for mistakes/blunders only).
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { PositionFeatures, MoveLabel, RatingTier, MistakeTheme } from '../types';
import { LABEL_DISPLAY } from '../utils/classification';

// ─── Theme classification ─────────────────────────────────────────────────────

/**
 * Map position signals to a mistake theme.
 * A single move can contribute to multiple themes.
 */
export function classifyMistakeThemes(
  features: PositionFeatures,
  label: MoveLabel,
  moveNumber: number,
): MistakeTheme[] {
  const themes: MistakeTheme[] = [];

  if (features.hanging_pieces) themes.push('hanging_pieces');
  if (features.king_safety_status === 'exposed' || features.king_safety_status === 'critical') {
    themes.push('king_safety');
  }
  if (features.tactical_threat_allowed && features.evaluation_drop > 150) {
    themes.push('tactics');
  }
  if (moveNumber <= 15) themes.push('opening');
  // Rough endgame heuristic: low material means endgame
  if (Math.abs(features.material_balance) <= 3 && features.evaluation_drop > 50) {
    themes.push('endgame');
  }
  if (themes.length === 0) themes.push('positional');

  return themes;
}

interface CriticalMoveEntry {
  features: PositionFeatures;
  label: MoveLabel;
  moveNumber: number;
  themes: MistakeTheme[];
}

interface GameSummaryInput {
  gameId: string;
  criticalMoves: CriticalMoveEntry[];
  ratingTier: RatingTier;
  playerColor: 'white' | 'black' | 'unknown';
}

// ─── Prompt building ──────────────────────────────────────────────────────────

function buildGameSummaryPrompt(input: GameSummaryInput): string {
  const { criticalMoves, ratingTier, playerColor } = input;

  // Aggregate theme counts
  const themeCounts: Partial<Record<MistakeTheme, number>> = {};
  let tacticalErrors = 0;
  let positionalErrors = 0;

  for (const entry of criticalMoves) {
    for (const theme of entry.themes) {
      themeCounts[theme] = (themeCounts[theme] ?? 0) + 1;
    }
    if (entry.themes.includes('tactics') || entry.themes.includes('hanging_pieces')) {
      tacticalErrors++;
    } else {
      positionalErrors++;
    }
  }

  const sortedThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([theme, count]) => `${theme.replace(/_/g, ' ')} (${count}x)`);

  const moveSummaries = criticalMoves
    .slice(0, 10) // cap at 10 to keep prompt size manageable
    .map((m) => {
      const drop = (m.features.evaluation_drop / 100).toFixed(2);
      return `  Move ${m.moveNumber}: ${m.features.move} (${LABEL_DISPLAY[m.label]}, -${drop} pawns) — themes: ${m.themes.join(', ')}`;
    })
    .join('\n');

  const playerDesc = ratingTier === 'beginner'
    ? 'a beginner'
    : ratingTier === 'intermediate'
    ? 'an intermediate player'
    : 'an advanced player';

  return `You are a professional chess coach reviewing a full game for ${playerDesc} playing as ${playerColor}.

Critical moves in this game:
${moveSummaries || '  (none recorded)'}

Error breakdown:
• Tactical errors: ${tacticalErrors}
• Positional errors: ${positionalErrors}
• Top recurring themes: ${sortedThemes.join(', ') || 'general play'}

Write a concise post-game summary with:
1. Top 3 recurring weaknesses (be specific and educational)
2. ONE concrete training suggestion
3. Overall assessment (1-2 sentences)

Keep total response under 160 words. Use plain numbered format. No markdown.`;
}

// ─── LLM dispatch (reuse same pattern as explanation service) ─────────────────

interface LLMResult {
  text: string;
  prompt_tokens: number;
  completion_tokens: number;
  model: string;
}

async function callLLM(prompt: string): Promise<LLMResult> {
  const model = env.LLM_MODEL;

  if (env.LLM_PROVIDER === 'anthropic') {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model,
      max_tokens: env.LLM_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim();
    return {
      text,
      prompt_tokens: res.usage?.input_tokens ?? 0,
      completion_tokens: res.usage?.output_tokens ?? 0,
      model,
    };
  }

  // OpenAI-compatible (openai / ollama / custom)
  const baseURL = env.LLM_BASE_URL || undefined;
  const apiKey = env.OPENAI_API_KEY || 'ollama';
  const client = new OpenAI({ apiKey, baseURL });
  const res = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: env.LLM_MAX_TOKENS,
    temperature: env.LLM_TEMPERATURE,
  });
  return {
    text: res.choices[0]?.message?.content?.trim() ?? '',
    prompt_tokens: res.usage?.prompt_tokens ?? 0,
    completion_tokens: res.usage?.completion_tokens ?? 0,
    model,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GameSummaryResult {
  summary_text: string;
  top_weaknesses: string[];
  training_focus: string;
  tactical_error_count: number;
  positional_error_count: number;
  prompt_tokens: number;
  completion_tokens: number;
  model_used: string;
  theme_counts: Partial<Record<MistakeTheme, number>>;
}

export async function generateGameSummary(
  input: GameSummaryInput,
): Promise<GameSummaryResult> {
  const { criticalMoves } = input;

  // Compute theme counts & error split locally (needed regardless of LLM)
  const themeCounts: Partial<Record<MistakeTheme, number>> = {};
  let tacticalErrors = 0;
  let positionalErrors = 0;

  for (const entry of criticalMoves) {
    for (const theme of entry.themes) {
      themeCounts[theme] = (themeCounts[theme] ?? 0) + 1;
    }
    if (entry.themes.includes('tactics') || entry.themes.includes('hanging_pieces')) {
      tacticalErrors++;
    } else {
      positionalErrors++;
    }
  }

  const sortedThemes = Object.entries(themeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([theme]) => theme.replace(/_/g, ' '));

  if (!env.AI_EXPLANATIONS_ENABLED) {
    const providerKey = env.LLM_PROVIDER === 'anthropic' ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY;
    if (!providerKey && env.LLM_PROVIDER !== 'ollama' && env.LLM_PROVIDER !== 'custom') {
      return {
        summary_text: 'AI explanations disabled. Enable AI_EXPLANATIONS_ENABLED=true and provide an API key.',
        top_weaknesses: sortedThemes,
        training_focus: 'Review your critical moves above.',
        tactical_error_count: tacticalErrors,
        positional_error_count: positionalErrors,
        prompt_tokens: 0,
        completion_tokens: 0,
        model_used: 'none',
        theme_counts: themeCounts,
      };
    }
  }

  const prompt = buildGameSummaryPrompt(input);
  logger.info('Generating AI game summary', { gameId: input.gameId });

  let llmResult: LLMResult;
  try {
    llmResult = await callLLM(prompt);
  } catch (err) {
    logger.error('Game summary LLM call failed', { error: String(err) });
    // Graceful fallback — return stats-only summary without crashing
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      summary_text: `AI summary unavailable: ${errMsg}. Load a model in LM Studio and try again.`,
      top_weaknesses: sortedThemes,
      training_focus: sortedThemes.length > 0
        ? `Focus on your most frequent mistake type: ${sortedThemes[0]}.`
        : 'Review your critical moves to identify patterns.',
      tactical_error_count: tacticalErrors,
      positional_error_count: positionalErrors,
      prompt_tokens: 0,
      completion_tokens: 0,
      model_used: 'none',
      theme_counts: themeCounts,
    };
  }

  // Parse weaknesses and training focus from the response
  const lines = llmResult.text.split('\n').filter(Boolean);
  const weaknesses: string[] = [];
  let trainingFocus = '';

  for (const line of lines) {
    const trimmed = line.replace(/^\d+\.\s*/, '').trim();
    if (weaknesses.length < 3 && trimmed && !trimmed.toLowerCase().startsWith('training')) {
      weaknesses.push(trimmed);
    } else if (trimmed.toLowerCase().includes('train') || trimmed.toLowerCase().includes('practic')) {
      trainingFocus = trimmed;
    }
  }

  if (weaknesses.length === 0) weaknesses.push(...sortedThemes);
  if (!trainingFocus) trainingFocus = 'Focus on your most frequent mistake type.';

  return {
    summary_text: llmResult.text,
    top_weaknesses: weaknesses.slice(0, 3),
    training_focus: trainingFocus,
    tactical_error_count: tacticalErrors,
    positional_error_count: positionalErrors,
    prompt_tokens: llmResult.prompt_tokens,
    completion_tokens: llmResult.completion_tokens,
    model_used: llmResult.model,
    theme_counts: themeCounts,
  };
}

export { classifyMistakeThemes as classifyThemes };
export type { CriticalMoveEntry, GameSummaryInput };
