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
  OPENAI_API_KEY: optional('OPENAI_API_KEY', ''),
} as const;
