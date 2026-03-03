import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'events';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { EngineEvaluationResult } from '../types';
import { mateToCentipawns } from '../utils/classification';

/**
 * Wraps a Stockfish process with a simple UCI protocol handler.
 * Each instance manages ONE engine process.
 */
export class StockfishProcess extends EventEmitter {
  private process: ChildProcessWithoutNullStreams;
  private buffer = '';
  private ready = false;
  private resolveReady: (() => void) | null = null;

  constructor(private stockfishPath: string) {
    super();
    this.process = spawn(stockfishPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });

    this.process.stdout.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) this.emit('line', trimmed);
      }
    });

    this.process.stderr.on('data', (data: Buffer) => {
      logger.warn('Stockfish stderr', { msg: data.toString().trim() });
    });

    this.process.on('exit', (code) => {
      logger.info('Stockfish process exited', { code });
    });
  }

  send(command: string): void {
    this.process.stdin.write(command + '\n');
  }

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      const timeout = setTimeout(() => {
        this.removeListener('line', onLine);
        reject(new Error('Stockfish init timed out after 15s'));
      }, 15000);

      const onLine = (line: string) => {
        if (line === 'uciok') {
          // Do NOT remove listener here — we still need to catch 'readyok'
          this.send('setoption name Hash value 128');
          this.send('setoption name Threads value 1');
          this.send('isready');
        }
        if (line === 'readyok') {
          clearTimeout(timeout);
          this.removeListener('line', onLine);
          this.ready = true;
          resolve();
        }
      };
      this.on('line', onLine);
      this.send('uci');
    });
  }

  async evaluate(fen: string, depth: number): Promise<EngineEvaluationResult> {
    if (!this.ready) throw new Error('Engine not ready');
    return this._search(fen, `go depth ${depth}`);
  }

  /** Time-capped search — always returns within movetime + a small buffer. */
  async evaluateTimed(fen: string, movetime: number): Promise<EngineEvaluationResult> {
    if (!this.ready) throw new Error('Engine not ready');
    return this._search(fen, `go movetime ${movetime}`);
  }

  private _search(fen: string, goCmd: string): Promise<EngineEvaluationResult> {
    return new Promise((resolve, reject) => {
      let bestLine = '';
      let bestMove = '';
      const timeout = setTimeout(() => {
        this.removeAllListeners('line');
        reject(new Error('Engine evaluation timeout'));
      }, 30000);

      const onLine = (line: string) => {
        if (line.startsWith('info') && line.includes(' pv ')) {
          bestLine = line;
        }
        if (line.startsWith('bestmove')) {
          clearTimeout(timeout);
          this.removeListener('line', onLine);

          const parts = line.split(' ');
          bestMove = parts[1] ?? '';

          // Parse score from last info line
          const scoreMatch = bestLine.match(/score (cp|mate) (-?\d+)/);
          if (!scoreMatch) {
            resolve({ score: 0, mate: null, bestMove, depth: 0 });
            return;
          }

          const scoreType = scoreMatch[1];
          const scoreValue = parseInt(scoreMatch[2], 10);

          if (scoreType === 'mate') {
            resolve({
              score: mateToCentipawns(scoreValue),
              mate: scoreValue,
              bestMove,
              depth: 0,
            });
          } else {
            resolve({ score: scoreValue, mate: null, bestMove, depth: 0 });
          }
        }
      };

      this.on('line', onLine);
      this.send(`position fen ${fen}`);
      this.send(goCmd);
    });
  }

  destroy(): void {
    try {
      this.send('quit');
      this.process.kill();
    } catch (_) { /* ignore */ }
  }
}

/**
 * Pool of Stockfish processes with concurrency control.
 */
export class EngineService {
  private pool: StockfishProcess[] = [];
  private queue: Array<{
    resolve: (engine: StockfishProcess) => void;
    reject: (err: Error) => void;
  }> = [];
  private available: StockfishProcess[] = [];
  private initialised = false;

  async init(): Promise<void> {
    if (this.initialised) return;
    logger.info('Initialising Stockfish engine pool', {
      size: env.ENGINE_MAX_CONCURRENT,
      path: env.STOCKFISH_PATH,
    });
    for (let i = 0; i < env.ENGINE_MAX_CONCURRENT; i++) {
      const sf = new StockfishProcess(env.STOCKFISH_PATH);
      await sf.init();
      this.pool.push(sf);
      this.available.push(sf);
    }
    this.initialised = true;
    logger.info('Engine pool ready');
  }

  private acquire(): Promise<StockfishProcess> {
    if (this.available.length > 0) {
      return Promise.resolve(this.available.pop()!);
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ resolve, reject });
    });
  }

  private release(engine: StockfishProcess): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next.resolve(engine);
    } else {
      this.available.push(engine);
    }
  }

  async evaluate(fen: string, depth = env.ENGINE_DEPTH): Promise<EngineEvaluationResult> {
    const engine = await this.acquire();
    try {
      return await engine.evaluate(fen, depth);
    } finally {
      this.release(engine);
    }
  }

  /** Fast time-capped evaluation for interactive use (tutorial, hints). */
  async evaluateFast(fen: string, movetime: number): Promise<EngineEvaluationResult> {
    const engine = await this.acquire();
    try {
      return await engine.evaluateTimed(fen, movetime);
    } finally {
      this.release(engine);
    }
  }

  shutdown(): void {
    for (const sf of this.pool) sf.destroy();
    this.pool = [];
    this.available = [];
    this.initialised = false;
  }
}

export const engineService = new EngineService();
