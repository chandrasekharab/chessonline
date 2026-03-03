import { useState, useEffect, useCallback, useRef } from 'react';
import { Chess, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import toast from 'react-hot-toast';
import { puzzleApi, PuzzlePublic, PuzzleMoveResult, getErrorMessage } from '../../services/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLegalTargets(fen: string, square: Square): Square[] {
  try {
    const ch = new Chess(fen);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (ch.moves({ square, verbose: true }) as any[]).map((m) => m.to as Square);
  } catch { return []; }
}

function isPieceMine(fen: string, sq: Square, color: 'white' | 'black'): boolean {
  try {
    const ch = new Chess(fen);
    const p = ch.get(sq);
    if (!p) return false;
    return color === 'white' ? p.color === 'w' : p.color === 'b';
  } catch { return false; }
}

function sideToMove(fen: string): 'white' | 'black' {
  return fen.split(' ')[1] === 'w' ? 'white' : 'black';
}

function isPromotion(fen: string, from: Square, to: Square): boolean {
  try {
    const ch = new Chess(fen);
    const p = ch.get(from);
    if (!p || p.type !== 'p') return false;
    return (p.color === 'w' && to[1] === '8') || (p.color === 'b' && to[1] === '1');
  } catch { return false; }
}

const THEME_LABELS: Record<string, string> = {
  mate_in_1: 'Mate in 1', back_rank: 'Back Rank', fork: 'Fork',
  pin: 'Pin', skewer: 'Skewer', hanging_piece: 'Hanging Piece',
  sacrifice: 'Sacrifice', removal: 'Remove Defender', defense: 'Defense',
  tactics: 'Tactics',
};

const DIFF_LABELS: Record<number, string> = {
  1: 'Beginner', 2: 'Easy', 3: 'Intermediate', 4: 'Advanced', 5: 'Expert',
};

// ── Component ─────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'playing' | 'solved' | 'resigned';

export default function PuzzlePage() {
  const [puzzle, setPuzzle]     = useState<PuzzlePublic | null>(null);
  const [phase, setPhase]       = useState<Phase>('loading');
  const [fen, setFen]           = useState('');
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [revealedSolution, setRevealedSolution] = useState<string | null>(null);
  const [engineThinking, setEngineThinking] = useState(false);
  const [stats, setStats]       = useState<{ solved: number; attempted: number; accuracy: number } | null>(null);
  const [filterDifficulty, setFilterDifficulty] = useState<number | undefined>(undefined);

  // Click-to-move state
  const [selected, setSelected]       = useState<Square | null>(null);
  const [optionSquares, setOptionSquares] = useState<Square[]>([]);
  const [lastMove, setLastMove]         = useState<{ from: Square; to: Square } | null>(null);
  const [wrongSquare, setWrongSquare]   = useState<Square | null>(null);

  // Board resize
  const [boardWidth, setBoardWidth] = useState(480);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const playerColor: 'white' | 'black' = puzzle ? sideToMove(puzzle.fen) : 'white';

  // ── Load a puzzle ──────────────────────────────────────────────────────────
  const loadPuzzle = useCallback(async (difficulty?: number) => {
    setPhase('loading');
    setPuzzle(null);
    setFeedback('');
    setRevealedSolution(null);
    setSelected(null);
    setOptionSquares([]);
    setLastMove(null);
    setWrongSquare(null);
    setSolutionIndex(0);
    try {
      const res = await puzzleApi.next(undefined, difficulty);
      const p = res.data.puzzle;
      setPuzzle(p);
      setFen(p.fen);
      setPhase('playing');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to load puzzle');
      setPhase('loading');
    }
  }, []);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const res = await puzzleApi.stats();
      setStats({ solved: res.data.solved_count, attempted: res.data.attempted_count, accuracy: res.data.accuracy });
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    loadPuzzle(filterDifficulty);
    loadStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resize ────────────────────────────────────────────────────────────────
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startWidth: boardWidth };
    const onMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      setBoardWidth(Math.min(800, Math.max(280, dragState.current.startWidth + ev.clientX - dragState.current.startX)));
    };
    const onUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [boardWidth]);

  // ── Move submission ───────────────────────────────────────────────────────
  const submitMove = useCallback(async (from: Square, to: Square, promotion?: string) => {
    if (!puzzle || phase !== 'playing' || engineThinking) return;
    const moveUci = `${from}${to}${promotion ?? ''}`;

    try {
      const res = await puzzleApi.move(puzzle.id, moveUci, fen, solutionIndex);
      const data: PuzzleMoveResult = res.data;

      if (!data.correct) {
        // Flash wrong square
        setWrongSquare(to);
        setTimeout(() => setWrongSquare(null), 700);
        setFeedback(data.feedback);
        toast.error(data.feedback, { duration: 1500 });
        return;
      }

      // Correct move — update board
      const chess = new Chess(fen);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chess.move(moveUci as any);
      setFen(chess.fen());
      setLastMove({ from, to });
      setFeedback(data.feedback);

      if (data.solved) {
        setPhase('solved');
        toast.success('🎉 Puzzle Solved!', { duration: 3000 });
        loadStats();
        return;
      }

      // Engine reply
      if (data.engine_reply_uci && data.engine_reply_fen) {
        setEngineThinking(true);
        const efrom = data.engine_reply_uci.slice(0, 2) as Square;
        const eto   = data.engine_reply_uci.slice(2, 4) as Square;
        setTimeout(() => {
          setFen(data.engine_reply_fen!);
          setLastMove({ from: efrom, to: eto });
          setSolutionIndex(solutionIndex + 2);
          setEngineThinking(false);
          setFeedback('Your turn…');
        }, 600);
      } else {
        setSolutionIndex(solutionIndex + 2);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, [puzzle, phase, fen, solutionIndex, engineThinking, loadStats]);

  // ── Resign ────────────────────────────────────────────────────────────────
  const handleResign = useCallback(async () => {
    if (!puzzle) return;
    try {
      const res = await puzzleApi.resign(puzzle.id);
      setRevealedSolution(res.data.solution_uci);
      setPhase('resigned');
      loadStats();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, [puzzle, loadStats]);

  // ── Click-to-move ─────────────────────────────────────────────────────────
  const handleSquareClick = useCallback((sq: Square) => {
    if (phase !== 'playing' || engineThinking) return;
    const myTurn = sideToMove(fen) === playerColor;
    if (!myTurn) return;

    if (selected) {
      if (optionSquares.includes(sq)) {
        // Execute
        const promo = isPromotion(fen, selected, sq) ? 'q' : undefined;
        submitMove(selected, sq, promo);
        setSelected(null);
        setOptionSquares([]);
      } else if (isPieceMine(fen, sq, playerColor)) {
        // Reselect another piece
        setSelected(sq);
        setOptionSquares(getLegalTargets(fen, sq));
      } else {
        setSelected(null);
        setOptionSquares([]);
      }
    } else {
      if (isPieceMine(fen, sq, playerColor)) {
        setSelected(sq);
        setOptionSquares(getLegalTargets(fen, sq));
      }
    }
  }, [phase, fen, playerColor, selected, optionSquares, submitMove, engineThinking]);

  // Drag-to-move
  const onPieceDrop = useCallback((from: Square, to: Square, piece: string): boolean => {
    if (phase !== 'playing' || engineThinking) return false;
    const myColor = playerColor === 'white' ? 'w' : 'b';
    if (!piece.startsWith(myColor)) return false;
    const promo = isPromotion(fen, from, to) ? 'q' : undefined;
    submitMove(from, to, promo);
    return true;
  }, [phase, fen, playerColor, submitMove, engineThinking]);

  // ── Custom squares ────────────────────────────────────────────────────────
  const customSquareStyles: Record<string, React.CSSProperties> = {};
  if (selected) {
    customSquareStyles[selected] = { background: 'rgba(255,215,0,0.45)' };
  }
  optionSquares.forEach((sq) => {
    customSquareStyles[sq] = {
      background: 'radial-gradient(circle, rgba(0,0,0,0.18) 30%, transparent 70%)',
    };
  });
  if (lastMove) {
    customSquareStyles[lastMove.from] = { background: 'rgba(99,190,123,0.35)' };
    customSquareStyles[lastMove.to]   = { background: 'rgba(99,190,123,0.45)' };
  }
  if (wrongSquare) {
    customSquareStyles[wrongSquare] = { background: 'rgba(239,68,68,0.5)' };
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      {/* ── Left panel: board ── */}
      <div style={s.boardCol}>
        {/* Board + resize handle */}
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <div style={{ width: boardWidth }}>
            <Chessboard
              id="puzzle-board"
              position={fen || 'start'}
              boardWidth={boardWidth}
              boardOrientation={playerColor}
              onSquareClick={handleSquareClick}
              onPieceDrop={onPieceDrop}
              customSquareStyles={customSquareStyles}
              arePremovesAllowed={false}
            />
          </div>
          <div
            onMouseDown={onResizeStart}
            title="Drag to resize"
            style={s.resizeHandle}
          />
        </div>

        {/* Feedback bar */}
        {feedback && (
          <div style={{
            ...s.feedbackBar,
            background: phase === 'solved' ? '#14532d' : phase === 'resigned' ? '#451a03' : '#1e293b',
            borderColor: phase === 'solved' ? '#16a34a' : phase === 'resigned' ? '#b45309' : '#334155',
          }}>
            {feedback}
          </div>
        )}

        {/* Controls */}
        <div style={s.controls}>
          {phase === 'playing' && !engineThinking && (
            <button style={s.btnGhost} onClick={handleResign}>Give Up</button>
          )}
          {(phase === 'solved' || phase === 'resigned') && (
            <button style={s.btnPrimary} onClick={() => loadPuzzle(filterDifficulty)}>
              Next Puzzle →
            </button>
          )}
          {engineThinking && (
            <span style={{ color: '#94a3b8', fontSize: 14 }}>Engine is replying…</span>
          )}
        </div>
      </div>

      {/* ── Right panel: info ── */}
      <div style={s.infoCol}>
        {/* Stats strip */}
        {stats && (
          <div style={s.statsRow}>
            <StatBadge label="Solved"   value={stats.solved}   color="#22c55e" />
            <StatBadge label="Total"    value={stats.attempted} color="#60a5fa" />
            <StatBadge label="Accuracy" value={`${stats.accuracy}%`} color="#f59e0b" />
          </div>
        )}

        {/* Difficulty filter */}
        <div style={s.section}>
          <label style={s.label}>Filter by Difficulty</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[undefined, 1, 2, 3, 4, 5].map((d) => (
              <button
                key={d ?? 'all'}
                onClick={() => { setFilterDifficulty(d); loadPuzzle(d); }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 5,
                  fontSize: 13,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: filterDifficulty === d ? '#f59e0b' : '#334155',
                  background:  filterDifficulty === d ? '#78350f' : '#1e293b',
                  color:       filterDifficulty === d ? '#fef3c7' : '#94a3b8',
                }}
              >
                {d ? DIFF_LABELS[d] : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Puzzle card */}
        {phase === 'loading' && (
          <div style={{ color: '#94a3b8', padding: '24px 0' }}>Loading puzzle…</div>
        )}
        {puzzle && (
          <div style={s.puzzleCard}>
            <div style={s.puzzleTitle}>{puzzle.title}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <Tag label={THEME_LABELS[puzzle.theme] ?? puzzle.theme} color="#f59e0b" bg="#451a03" />
              <Tag label={DIFF_LABELS[puzzle.difficulty]} color="#60a5fa" bg="#0c2340" />
              <Tag label={playerColor === 'white' ? '⬜ White to move' : '⬛ Black to move'} color="#e2e8f0" bg="#1e293b" />
            </div>
            <p style={s.desc}>{puzzle.description}</p>

            {/* Progress dots */}
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              {Array.from({ length: puzzle.total_player_moves }).map((_, i) => {
                const done = i < Math.floor(solutionIndex / 2) || phase === 'solved';
                return (
                  <div
                    key={i}
                    style={{
                      width: 12, height: 12, borderRadius: '50%',
                      background: done ? '#22c55e' : i === Math.floor(solutionIndex / 2) && phase === 'playing' ? '#f59e0b' : '#334155',
                    }}
                  />
                );
              })}
            </div>
            {puzzle.total_player_moves > 1 && (
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                Move {Math.floor(solutionIndex / 2) + 1} of {puzzle.total_player_moves}
              </div>
            )}
          </div>
        )}

        {/* Revealed solution */}
        {revealedSolution && (
          <div style={s.solutionBox}>
            <div style={{ color: '#fbbf24', fontWeight: 600, marginBottom: 6 }}>Solution</div>
            {revealedSolution.split(' ').map((mv, i) => (
              <span key={i} style={{
                display: 'inline-block',
                margin: '2px 4px',
                padding: '2px 8px',
                borderRadius: 4,
                background: i % 2 === 0 ? '#1e3a5f' : '#1e293b',
                color: '#e2e8f0',
                fontSize: 13,
                fontFamily: 'monospace',
              }}>{mv}</span>
            ))}
          </div>
        )}

        {/* Solved celebration */}
        {phase === 'solved' && (
          <div style={s.solvedBanner}>
            🎉 Puzzle Solved!
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatBadge({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color, fontWeight: 700, fontSize: 20 }}>{value}</div>
      <div style={{ color: '#64748b', fontSize: 12 }}>{label}</div>
    </div>
  );
}

function Tag({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      background: bg, color, border: `1px solid ${color}33`,
      borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600,
    }}>{label}</span>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    gap: 28,
    padding: '24px 32px',
    minHeight: 'calc(100vh - 56px)',
    background: '#0f172a',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  boardCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  resizeHandle: {
    width: 8,
    cursor: 'col-resize',
    background: '#1e293b',
    borderLeft: '2px solid #334155',
    borderRadius: '0 4px 4px 0',
    transition: 'background 0.15s',
    flexShrink: 0,
  },
  feedbackBar: {
    padding: '10px 14px',
    borderRadius: 6,
    border: '1px solid',
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: 500,
  },
  controls: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
  },
  btnPrimary: {
    padding: '8px 18px',
    borderRadius: 6,
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
  btnGhost: {
    padding: '7px 16px',
    borderRadius: 6,
    border: '1px solid #334155',
    background: 'transparent',
    color: '#94a3b8',
    fontSize: 14,
    cursor: 'pointer',
  },
  infoCol: {
    flex: 1,
    minWidth: 260,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  statsRow: {
    display: 'flex',
    gap: 24,
    padding: '14px 18px',
    background: '#1e293b',
    borderRadius: 8,
    border: '1px solid #334155',
    justifyContent: 'space-around',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  puzzleCard: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '18px 20px',
  },
  puzzleTitle: {
    color: '#f8fafc',
    fontWeight: 700,
    fontSize: 20,
    marginBottom: 10,
  },
  desc: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 1.6,
    margin: 0,
  },
  solutionBox: {
    background: '#1c1108',
    border: '1px solid #78350f',
    borderRadius: 8,
    padding: '14px 16px',
  },
  solvedBanner: {
    background: '#14532d',
    border: '1px solid #16a34a',
    borderRadius: 8,
    padding: '16px 20px',
    color: '#86efac',
    fontWeight: 700,
    fontSize: 18,
    textAlign: 'center',
  },
};
