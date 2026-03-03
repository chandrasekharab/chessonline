import { GameRepository } from '../repositories/game.repository';
import { AnalysisRepository } from '../repositories/analysis.repository';
import { parsePgn, sanitisePgn, validatePgn } from '../utils/pgn.parser';
import { enqueueAnalysis } from '../queue/analysisQueue';
import { Game } from '../types';

const gameRepo = new GameRepository();
const analysisRepo = new AnalysisRepository();

export class GamesService {
  async createGame(userId: string, rawPgn: string): Promise<Game> {
    const pgn = sanitisePgn(rawPgn);
    const validation = validatePgn(pgn);
    if (!validation.valid) {
      throw Object.assign(new Error(`Invalid PGN: ${validation.error}`), { statusCode: 400 });
    }

    const { metadata } = parsePgn(pgn);
    const game = await gameRepo.create(userId, pgn, metadata);
    return game;
  }

  async listGames(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<{ games: Game[]; total: number }> {
    const [games, total] = await Promise.all([
      gameRepo.findByUser(userId, limit, offset),
      gameRepo.countByUser(userId),
    ]);
    return { games, total };
  }

  async getGame(gameId: string, userId: string): Promise<Game> {
    const game = await gameRepo.findByIdAndUser(gameId, userId);
    if (!game) {
      throw Object.assign(new Error('Game not found'), { statusCode: 404 });
    }
    return game;
  }

  async triggerAnalysis(gameId: string, userId: string, depth?: number): Promise<void> {
    const game = await gameRepo.findByIdAndUser(gameId, userId);
    if (!game) {
      throw Object.assign(new Error('Game not found'), { statusCode: 404 });
    }
    if (game.status === 'analyzing') {
      throw Object.assign(new Error('Analysis already in progress'), { statusCode: 409 });
    }

    await enqueueAnalysis({ gameId, userId, depth });
  }

  async getAnalysis(gameId: string, userId: string) {
    const game = await gameRepo.findByIdAndUser(gameId, userId);
    if (!game) {
      throw Object.assign(new Error('Game not found'), { statusCode: 404 });
    }

    const [rows, summary] = await Promise.all([
      analysisRepo.findByGame(gameId),
      analysisRepo.getSummary(gameId),
    ]);

    return {
      game,
      moves: rows,
      summary,
    };
  }

  async deleteGame(gameId: string, userId: string): Promise<void> {
    const deleted = await gameRepo.delete(gameId, userId);
    if (!deleted) {
      throw Object.assign(new Error('Game not found'), { statusCode: 404 });
    }
  }
}

export const gamesService = new GamesService();
