import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { gamesApi, getErrorMessage } from '../../services/api';
import ChessBoardView from '../analysis/ChessBoard';
import EvaluationBar from '../analysis/EvaluationBar';
import MoveList from '../analysis/MoveList';
import AnalysisSummary from '../analysis/AnalysisSummary';
import AnalysisProgressBar from '../analysis/AnalysisProgressBar';
import type { AnalysisMove } from '../../types';
import { ArrowLeft, PlayCircle, RefreshCw } from 'lucide-react';

export default function GameView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1);

  const { data, refetch, isLoading, isError } = useQuery({
    queryKey: ['analysis', id],
    queryFn: () => gamesApi.getAnalysis(id!).then((r) => r.data),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.game?.status;
      return status === 'analyzing' ? 1000 : false;
    },
  });

  const analyseMutation = useMutation({
    mutationFn: () => gamesApi.analyze(id!),
    onSuccess: () => {
      toast.success('Analysis started');
      refetch();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const game = data?.game;
  const moves: AnalysisMove[] = data?.moves ?? [];
  const summary = data?.summary ?? {};

  // Determine board FEN for current move
  const currentMove = currentMoveIndex >= 0 ? moves[currentMoveIndex] : null;

  // Build starting FEN position or use move's FEN
  let boardFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  if (currentMove) {
    boardFen = currentMove.fen;
  }

  const currentEval =
    currentMove?.eval_after ?? (moves.length > 0 ? moves[0]?.eval_before : 0) ?? 0;

  if (isLoading) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={{ color: '#64748b', marginTop: 12 }}>Loading game…</p>
      </div>
    );
  }

  if (isError || !game) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ef4444' }}>Failed to load game.</p>
        <button onClick={() => navigate('/')} style={styles.backBtn}>
          <ArrowLeft size={15} /> Back
        </button>
      </div>
    );
  }

  const meta = game.metadata_json;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={() => navigate('/')} style={styles.backBtn}>
          <ArrowLeft size={16} /> Back
        </button>
        <div style={styles.gameTitle}>
          <span style={styles.players}>
            {meta.white ?? 'White'} <span style={styles.vs}>vs</span> {meta.black ?? 'Black'}
          </span>
          <span style={styles.metaSmall}>
            {meta.event ?? 'Casual'} · {meta.date ?? '—'} · {meta.result ?? '—'}
          </span>
        </div>
        <button
          onClick={() => analyseMutation.mutate()}
          style={styles.analyseBtn}
          disabled={game.status === 'analyzing' || analyseMutation.isPending}
        >
          {game.status === 'analyzing' ? (
            <>
              <RefreshCw size={16} className="spin" /> Analysing…
            </>
          ) : moves.length > 0 ? (
            <>
              <RefreshCw size={16} /> Re-Analyse
            </>
          ) : (
            <>
              <PlayCircle size={16} /> Analyse
            </>
          )}
        </button>
      </div>

      {game.status === 'analyzing' && (
        <AnalysisProgressBar
          current={game.progress_current ?? 0}
          total={game.progress_total ?? 0}
        />
      )}

      {moves.length > 0 && (
        <>
          <AnalysisSummary summary={summary} />

          <div style={styles.board}>
            {/* Eval Bar */}
            <EvaluationBar evalCp={currentEval} />

            {/* Chessboard */}
            <ChessBoardView
              fen={boardFen}
              lastMove={currentMove ? undefined : undefined}
              orientation="white"
            />

            {/* Move info panel */}
            {currentMove && (
              <div style={styles.moveInfo}>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>
                  Move {currentMove.move_number} — {currentMove.move}
                </div>
                {currentMove.best_move && currentMove.best_move !== currentMove.move && (
                  <div style={{ color: '#60a5fa', fontSize: 13 }}>
                    Best: {currentMove.best_move}
                  </div>
                )}
                {currentMove.explanation && (
                  <div style={{ color: '#a3a3a3', fontSize: 12, marginTop: 4 }}>
                    {currentMove.explanation}
                  </div>
                )}
              </div>
            )}
          </div>

          <MoveList
            moves={moves}
            currentIndex={currentMoveIndex}
            onSelect={setCurrentMoveIndex}
          />
        </>
      )}

      {moves.length === 0 && game.status === 'uploaded' && (
        <div style={styles.center}>
          <span style={{ fontSize: 48 }}>♟</span>
          <p style={{ color: '#94a3b8' }}>No analysis yet. Click "Analyse" to start.</p>
        </div>
      )}

      {game.status === 'failed' && (
        <div style={styles.center}>
          <p style={{ color: '#ef4444' }}>Analysis failed. Try re-analysing.</p>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1200, margin: '0 auto', padding: '24px 20px' },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  gameTitle: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  players: { fontSize: 20, fontWeight: 700, color: '#f8fafc' },
  vs: { color: '#475569', fontWeight: 400 },
  metaSmall: { color: '#64748b', fontSize: 13 },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'transparent',
    border: '1px solid #334155',
    color: '#94a3b8',
    padding: '8px 14px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
  },
  analyseBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 18px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  board: {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  moveInfo: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 160,
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: '80px 20px',
    color: '#64748b',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #334155',
    borderTop: '3px solid #3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};
