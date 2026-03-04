/**
 * Explanation Service
 *
 * LLM wrapper that:
 *   1. Accepts structured position features (NOT raw FEN)
 *   2. Builds a tailored prompt based on player rating tier
 *   3. Calls the configured LLM provider (OpenAI-compatible API)
 *   4. Returns human-readable chess coaching explanation
 *
 * Provider selection via LLM_PROVIDER env var:
 *   openai    → api.openai.com (default)
 *   anthropic → api.anthropic.com (via Anthropic SDK)
 *   ollama    → http://localhost:11434/v1 (or LLM_BASE_URL)
 *   custom    → LLM_BASE_URL (any OpenAI-compatible endpoint)
 *
 * Future fine-tuned model compatibility:
 *   Set LLM_MODEL=<your-fine-tuned-model-id> to swap instantly.
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { PositionFeatures, RatingTier, MoveLabel } from '../types';
import { LABEL_DISPLAY } from '../utils/classification';

interface LLMUsage {
  prompt_tokens: number;
  completion_tokens: number;
  model: string;
}

interface LLMResult {
  text: string;
  usage: LLMUsage;
}

// ─── Personalisation helpers ──────────────────────────────────────────────────

const RATING_TIER_DESC: Record<RatingTier, string> = {
  beginner:     'a beginner (rated below 1000)',
  intermediate: 'an intermediate player (rated 1000–1600)',
  advanced:     'an advanced player (rated above 1600)',
};

const VARIATION_INSTRUCTION: Record<RatingTier, string> = {
  beginner:     'Keep the explanation simple. Do NOT mention move variations or notation.',
  intermediate: 'You may include ONE short variation (2-3 moves) to illustrate the point.',
  advanced:     'Include the main principal variation line and concrete move sequences.',
};

/**
 * Build a structured coaching prompt.
 * Note: no raw FEN is sent — only derived signals.
 */
function buildPrompt(
  features: PositionFeatures,
  classification: MoveLabel,
  ratingTier: RatingTier,
): string {
  const classLabel = LABEL_DISPLAY[classification];
  const tierDesc = RATING_TIER_DESC[ratingTier];
  const variationNote = VARIATION_INSTRUCTION[ratingTier];
  const pvStr = features.principal_variation.length > 0
    ? features.principal_variation.join(', ')
    : 'unavailable';

  return `You are a professional chess coach explaining a move to ${tierDesc}.

The player played: ${features.move}
Classification: ${classLabel}

Position signals:
• Evaluation dropped from ${(features.evaluation_before / 100).toFixed(2)} to ${(features.evaluation_after / 100).toFixed(2)} (${(features.evaluation_drop / 100).toFixed(2)} pawns)
• Material balance: ${features.material_balance > 0 ? '+' : ''}${features.material_balance} pawns (white perspective)
• King safety (moving side): ${features.king_safety_status.replace(/_/g, ' ')}
• Center control: ${features.center_control_status.replace(/_/g, ' ')}
• Hanging pieces after move: ${features.hanging_pieces ? 'yes' : 'no'}
• Tactical threat allowed: ${features.tactical_threat_allowed ?? 'none identified'}
• Better move was: ${features.better_alternative}
• Principal variation: ${pvStr}

${variationNote}

Explain in exactly 3 numbered sections:
1. Why this move was a problem
2. What the opponent can now do
3. What should have been played instead

Keep total response under 120 words. Use plain language. No markdown headers.`;
}

// ─── OpenAI-compatible client factory ─────────────────────────────────────────

function getOpenAIClient(): OpenAI {
  const baseURL = env.LLM_BASE_URL || undefined;
  const apiKey = env.LLM_PROVIDER === 'anthropic'
    ? env.ANTHROPIC_API_KEY
    : (env.OPENAI_API_KEY || 'ollama'); // ollama doesn't need a real key

  return new OpenAI({ apiKey, baseURL });
}

// ─── Anthropic client ─────────────────────────────────────────────────────────

function getAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

// ─── Provider dispatch ────────────────────────────────────────────────────────

async function callOpenAICompatible(prompt: string): Promise<LLMResult> {
  const client = getOpenAIClient();
  const model = env.LLM_MODEL;

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: env.LLM_MAX_TOKENS,
    temperature: env.LLM_TEMPERATURE,
  });

  const text = response.choices[0]?.message?.content?.trim() ?? '';
  return {
    text,
    usage: {
      prompt_tokens: response.usage?.prompt_tokens ?? 0,
      completion_tokens: response.usage?.completion_tokens ?? 0,
      model,
    },
  };
}

async function callAnthropic(prompt: string): Promise<LLMResult> {
  const client = getAnthropicClient();
  const model = env.LLM_MODEL;

  const response = await client.messages.create({
    model,
    max_tokens: env.LLM_MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim();

  const inputTokens  = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;

  return {
    text,
    usage: {
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      model,
    },
  };
}

async function dispatchLLM(prompt: string): Promise<LLMResult> {
  switch (env.LLM_PROVIDER) {
    case 'anthropic':
      return callAnthropic(prompt);
    case 'ollama':
    case 'custom':
    case 'openai':
    default:
      return callOpenAICompatible(prompt);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ExplanationResult {
  explanation: string;
  prompt_tokens: number;
  completion_tokens: number;
  model_used: string;
}

/**
 * Generate an explanation for a critical chess move.
 *
 * @param features   Structured signals from feature extraction
 * @param label      Move classification
 * @param ratingTier Player's rating tier for personalisation
 * @returns          Text explanation + token usage
 */
/**
 * Build a coaching prompt for a completed puzzle.
 */
function buildPuzzlePrompt(
  fen: string,
  solution: string[],
  tags: string[],
  ratingTier: RatingTier,
): string {
  const tierDesc = RATING_TIER_DESC[ratingTier];
  const variationNote = VARIATION_INSTRUCTION[ratingTier];
  const solutionStr = solution.join(', ');
  const tagStr = tags.length > 0 ? tags.map((t) => t.replace(/_/g, ' ')).join(', ') : 'general tactics';

  return `You are a chess coach explaining a tactical puzzle to ${tierDesc}.

Starting position (FEN): ${fen}
Correct solution: ${solutionStr}
Tactical theme(s): ${tagStr}

${variationNote}

Explain in exactly 3 numbered sections:
1. What the key tactical idea is
2. Why the solution works (what the opponent is forced to do)
3. The pattern name and when to look for it in future games

Keep total response under 120 words. Use plain language. No markdown headers.`;
}

/**
 * Generate a coaching explanation for a completed chess puzzle.
 */
export async function generatePuzzleExplanation(
  fen: string,
  solution: string[],
  tags: string[],
  ratingTier: RatingTier,
): Promise<ExplanationResult> {
  if (!env.AI_EXPLANATIONS_ENABLED) {
    return {
      explanation: 'AI explanations are disabled. Enable by setting AI_EXPLANATIONS_ENABLED=true.',
      prompt_tokens: 0,
      completion_tokens: 0,
      model_used: 'none',
    };
  }

  const providerKey = env.LLM_PROVIDER === 'anthropic' ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY;
  if (!providerKey && env.LLM_PROVIDER !== 'ollama' && env.LLM_PROVIDER !== 'custom') {
    return {
      explanation: 'No LLM API key configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.',
      prompt_tokens: 0,
      completion_tokens: 0,
      model_used: 'none',
    };
  }

  const prompt = buildPuzzlePrompt(fen, solution, tags, ratingTier);
  let result: Awaited<ReturnType<typeof dispatchLLM>>;
  try {
    result = await dispatchLLM(prompt);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('Puzzle LLM call failed', { error: errMsg });
    return {
      explanation: `AI coaching unavailable: ${errMsg}. Load a model in LM Studio to get puzzle explanations.`,
      prompt_tokens: 0,
      completion_tokens: 0,
      model_used: 'none',
    };
  }
  return {
    explanation: result.text,
    prompt_tokens: result.usage.prompt_tokens,
    completion_tokens: result.usage.completion_tokens,
    model_used: result.usage.model,
  };
}

// ─── Coach Chat ──────────────────────────────────────────────────────────────

export interface ChatContext {
  players?: string;
  event?: string;
  currentMove?: string;
  moveNumber?: number;
  label?: string;
  eval_before?: number;
  eval_after?: number;
  best_move?: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  reply: string;
  model_used: string;
}

function buildSystemPrompt(ctx: ChatContext): string {
  const gameLine = ctx.players
    ? `Game: ${ctx.players}${ctx.event ? ` (${ctx.event})` : ''}.`
    : 'Game context not provided.';

  const moveLine = ctx.currentMove
    ? `Currently viewing: Move ${ctx.moveNumber ?? '?'} — ${ctx.currentMove}` +
      (ctx.label ? ` (${ctx.label.replace(/_/g, ' ')})` : '') +
      (ctx.eval_before != null && ctx.eval_after != null
        ? `, eval ${(ctx.eval_before / 100).toFixed(2)} → ${(ctx.eval_after / 100).toFixed(2)}`
        : '') +
      (ctx.best_move ? `. Engine best: ${ctx.best_move}.` : '.')
    : 'No specific move selected.';

  return `You are a professional chess coach helping a player analyse their game. Be concise, friendly, and educational.\n${gameLine}\n${moveLine}\n\nAnswer in plain text under 160 words unless the player asks for more detail. Avoid raw FEN strings in replies.`;
}

async function callOpenAICompatibleChat(
  messages: { role: string; content: string }[],
): Promise<LLMResult> {
  const client = getOpenAIClient();
  const model = env.LLM_MODEL;
  const response = await client.chat.completions.create({
    model,
    messages: messages as Parameters<typeof client.chat.completions.create>[0]['messages'],
    max_tokens: env.LLM_MAX_TOKENS,
    temperature: env.LLM_TEMPERATURE,
  });
  const text = response.choices[0]?.message?.content?.trim() ?? '';
  return {
    text,
    usage: {
      prompt_tokens: response.usage?.prompt_tokens ?? 0,
      completion_tokens: response.usage?.completion_tokens ?? 0,
      model,
    },
  };
}

async function callAnthropicChat(
  system: string,
  history: ChatTurn[],
  message: string,
): Promise<LLMResult> {
  const client = getAnthropicClient();
  const model = env.LLM_MODEL;
  const messages: Anthropic.Messages.MessageParam[] = [
    ...history.map((t) => ({ role: t.role as 'user' | 'assistant', content: t.content })),
    { role: 'user', content: message },
  ];
  const response = await client.messages.create({
    model,
    max_tokens: env.LLM_MAX_TOKENS,
    system,
    messages,
  });
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim();
  return {
    text,
    usage: {
      prompt_tokens: response.usage?.input_tokens ?? 0,
      completion_tokens: response.usage?.output_tokens ?? 0,
      model,
    },
  };
}

/**
 * Normalise chat history so it strictly alternates user/assistant
 * and always starts with a 'user' turn.
 * LM Studio (and many local models) reject prompts that begin with
 * 'assistant' or contain consecutive same-role messages.
 */
function normalizeHistory(history: ChatTurn[]): ChatTurn[] {
  // Drop leading assistant messages
  let turns = history.slice();
  while (turns.length > 0 && turns[0].role === 'assistant') {
    turns = turns.slice(1);
  }

  // Merge consecutive same-role messages (join with newline)
  const normalized: ChatTurn[] = [];
  for (const turn of turns) {
    const last = normalized[normalized.length - 1];
    if (last && last.role === turn.role) {
      last.content += '\n' + turn.content;
    } else {
      normalized.push({ ...turn });
    }
  }

  // Ensure we end on an 'assistant' turn if the last real turn is user
  // (the new user message will be appended after, so history must end with assistant)
  // If history ends with 'user' that would create two consecutive user msgs — drop it
  if (normalized.length > 0 && normalized[normalized.length - 1].role === 'user') {
    normalized.pop();
  }

  return normalized;
}

export async function chatWithCoach(
  context: ChatContext,
  history: ChatTurn[],
  message: string,
): Promise<ChatResult> {
  if (!env.AI_EXPLANATIONS_ENABLED) {
    return { reply: 'AI coaching is disabled on this server.', model_used: 'none' };
  }

  const system = buildSystemPrompt(context);
  const safeHistory = normalizeHistory(history);

  try {
    let result: LLMResult;

    if (env.LLM_PROVIDER === 'anthropic') {
      result = await callAnthropicChat(system, safeHistory, message);
    } else {
      const messages = [
        { role: 'system', content: system },
        ...safeHistory.map((t) => ({ role: t.role, content: t.content })),
        { role: 'user', content: message },
      ];
      result = await callOpenAICompatibleChat(messages);
    }

    logger.info('Coach chat reply generated', { model: result.usage.model });
    return { reply: result.text, model_used: result.usage.model };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.warn('Coach chat LLM call failed', { error: errMsg });
    return {
      reply: `I'm unable to respond right now (${errMsg}). Make sure a model is loaded in LM Studio.`,
      model_used: 'none',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function generateMoveExplanation(
  features: PositionFeatures,
  label: MoveLabel,
  ratingTier: RatingTier,
): Promise<ExplanationResult> {
  if (!env.AI_EXPLANATIONS_ENABLED) {
    return {
      explanation: 'AI explanations are disabled. Enable by setting AI_EXPLANATIONS_ENABLED=true.',
      prompt_tokens: 0,
      completion_tokens: 0,
      model_used: 'none',
    };
  }

  const providerKey = env.LLM_PROVIDER === 'anthropic' ? env.ANTHROPIC_API_KEY : env.OPENAI_API_KEY;
  if (!providerKey && env.LLM_PROVIDER !== 'ollama' && env.LLM_PROVIDER !== 'custom') {
    logger.warn('No LLM API key configured — skipping explanation generation');
    return {
      explanation: 'No LLM API key configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.',
      prompt_tokens: 0,
      completion_tokens: 0,
      model_used: 'none',
    };
  }

  const prompt = buildPrompt(features, label, ratingTier);
  logger.debug('Calling LLM', { provider: env.LLM_PROVIDER, model: env.LLM_MODEL, tier: ratingTier });

  let result: Awaited<ReturnType<typeof dispatchLLM>>;
  try {
    result = await dispatchLLM(prompt);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('Move explanation LLM call failed', { error: errMsg });
    const labelDesc: Record<string, string> = {
      blunder: 'a blunder that loses significant material or evaluation',
      mistake: 'a mistake that misses a better continuation',
      missed_win: 'a missed winning opportunity',
      inaccuracy: 'a slight inaccuracy',
    };
    return {
      explanation: `AI coaching unavailable: ${errMsg}. This move was ${labelDesc[label] ?? 'notable'}. Load a model in LM Studio to get AI coaching.`,
      prompt_tokens: 0,
      completion_tokens: 0,
      model_used: 'none',
    };
  }
  logger.info('LLM explanation generated', {
    model: result.usage.model,
    promptTokens: result.usage.prompt_tokens,
    completionTokens: result.usage.completion_tokens,
  });

  return {
    explanation: result.text,
    prompt_tokens: result.usage.prompt_tokens,
    completion_tokens: result.usage.completion_tokens,
    model_used: result.usage.model,
  };
}
