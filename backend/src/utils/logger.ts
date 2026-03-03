import winston from 'winston';
import { env } from '../config/env';

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(timestamp(), errors({ stack: true }), json()),
  defaultMeta: { service: 'chess-insight-backend' },
  transports: [
    new winston.transports.Console({
      format: env.NODE_ENV === 'development' ? combine(colorize(), simple()) : combine(timestamp(), json()),
    }),
  ],
});
