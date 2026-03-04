import { Chess } from 'chess.js';
import { engineService } from './engine.service';
import { AnalysisRepository, InsertAnalysisRow } from '../repositories/analysis.repository';
import { GameRepository } from '../repositories/game.repository';
import { parsePgn } from '../utils/pgn.parser';
import { classifyMove, clampEval } from '../utils/classification';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { batchGenerateExplanations, getOrGenerateGameSummary } from './aiExplanation.orchestrator';

const gameRepo = new GameRepository();
const analysisRepo = new AnalysisRepository();

/**
 * Core analysis pipeline: parses PGN, evaluates each position with Stockfish,
 * classifies moves, and persists results.
 */
export async function analyseGame(
  gameId: string,
  depth = env.ENGINE_DEPTH
): Promise<void> {
  logger.info('Starting analysis', { gameId, depth });

  // Mark as analyzing
  await gameRepo.updateStatus(gameId, 'analyzing');

  const game = await gameRepo.findById(gameId);
  if (!game) throw new Error(`Game ${gameId} not found`);

  const parsed = parsePgn(game.pgn);
  if (!parsed.valid || parsed.moves.length === 0) {
    await gameRepo.updateStatus(gameId, 'failed');
    throw new Error(`Invalid PGN for game ${gameId}: ${parsed.error}`);
  }

  const chess = new Chess();
  const rows: InsertAnalysisRow[] = [];
  const totalMoves = parsed.moves.length;

  // Initialise progress
  await gameRepo.updateProgress(gameId, 0, totalMoves);

  // Evaluate starting position
  let evalBefore = await engineService.evaluate(chess.fen(), depth);

  for (let i = 0; i < parsed.moves.length; i++) {
    const parsedMove = parsed.moves[i];
    const isWhiteMove = i % 2 === 0;

    const evalBeforeCp = clampEval(evalBefore.score);

    // Make the move
    chess.move(parsedMove.move);
    const fenAfter = chess.fen();

    // Evaluate position after the move
    const evalAfterResult = await engineService.evaluate(fenAfter, depth);
    const evalAfterCp = clampEval(evalAfterResult.score);

    const evalDiff = evalBeforeCp - evalAfterCp;
    const label = classifyMove(evalBeforeCp, evalAfterCp, isWhiteMove);

    rows.push({
      gameId,
      moveNumber: parsedMove.moveNumber,
      move: parsedMove.move,
      fen: fenAfter,
      evalBefore: evalBeforeCp,
      evalAfter: evalAfterCp,
      evalDiff: Math.round(evalDiff * 100) / 100,
      label,
      bestMove: evalBefore.bestMove || null,
      explanation: null, // Filled by optional AI explanation step
    });

    // The "after" result becomes "before" for the next move
    evalBefore = evalAfterResult;

    // Update progress every move (fire-and-forget — don't block the loop)
    gameRepo.updateProgress(gameId, i + 1, totalMoves).catch(() => {});

    logger.debug('Analysis progress', { gameId, move: i + 1, total: totalMoves });
  }

  // Persist all analysis rows in a single transaction
  await analysisRepo.insertBatch(rows);
  await gameRepo.updateStatus(gameId, 'completed');

  logger.info('Analysis complete', { gameId, totalMoves: rows.length });

  // ── AI Explanation batch (fire-and-forget, non-blocking) ────────────────
  if (env.AI_EXPLANATIONS_ENABLED) {
    const userId = game.user_id;
    setImmediate(async () => {
      try {
        await batchGenerateExplanations(gameId, userId);
        await getOrGenerateGameSummary({ gameId, userId });
      } catch (err) {
        logger.error('Background AI explanation failed', { gameId, error: String(err) });
      }
    });
  }
}
