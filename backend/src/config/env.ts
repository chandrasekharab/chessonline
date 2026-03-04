import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: parseInt(optional('PORT', '7000'), 10),
  DATABASE_URL: required('DATABASE_URL'),
  REDIS_URL: optional('REDIS_URL', 'redis://localhost:6379'),
  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '7d'),
  STOCKFISH_PATH: optional('STOCKFISH_PATH', '/usr/games/stockfish'),
  ENGINE_DEPTH: parseInt(optional('ENGINE_DEPTH', '18'), 10),
  ENGINE_MAX_CONCURRENT: parseInt(optional('ENGINE_MAX_CONCURRENT', '2'), 10),
  MAX_FILE_SIZE_MB: parseInt(optional('MAX_FILE_SIZE_MB', '5'), 10),
  RATE_LIMIT_WINDOW_MS: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000'), 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(optional('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
  ANALYSIS_RATE_LIMIT_MAX: parseInt(optional('ANALYSIS_RATE_LIMIT_MAX', '10'), 10),
  // ─── AI Explanation Engine ───────────────────────────────────────────────
  OPENAI_API_KEY: optional('OPENAI_API_KEY', ''),
  ANTHROPIC_API_KEY: optional('ANTHROPIC_API_KEY', ''),
  LLM_PROVIDER: optional('LLM_PROVIDER', 'openai'),        // openai | anthropic | ollama | custom
  LLM_MODEL: optional('LLM_MODEL', 'gpt-4o-mini'),          // model name; swap freely
  LLM_BASE_URL: optional('LLM_BASE_URL', ''),               // custom OpenAI-compatible base URL
  LLM_MAX_TOKENS: parseInt(optional('LLM_MAX_TOKENS', '300'), 10),
  LLM_TEMPERATURE: parseFloat(optional('LLM_TEMPERATURE', '0.4')),
  // Only generate explanations for moves at or worse than this threshold (cp drop)
  EXPLANATION_MIN_DROP_CP: parseInt(optional('EXPLANATION_MIN_DROP_CP', '100'), 10),
  // Redis TTL for explanation cache (seconds) – default 30 days
  EXPLANATION_CACHE_TTL_S: parseInt(optional('EXPLANATION_CACHE_TTL_S', '2592000'), 10),
  AI_EXPLANATIONS_ENABLED: optional('AI_EXPLANATIONS_ENABLED', 'true') === 'true',
} as const;
