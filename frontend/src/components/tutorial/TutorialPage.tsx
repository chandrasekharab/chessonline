import { useState, useEffect, useCallback, useRef, CSSProperties } from 'react';
import { Chess, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useBoardThemeStore } from '../../store/boardThemeStore';
import toast from 'react-hot-toast';
import {
  tutorialApi,
  TutorialMoveDetail,
  TutorialMoveResponse,
  getErrorMessage,
} from '../../services/api';
import { LABEL_COLORS } from '../../types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Beginner', 2: 'Easy', 3: 'Intermediate', 4: 'Advanced', 5: 'Expert',
};

const LABEL_ICONS: Record<string, string> = {
  best: '✦', excellent: '✓', good: '·',
  inaccuracy: '⚠', mistake: '✗', blunder: '✗✗', missed_win: '☆',
};

type GamePhase = 'setup' | 'playing' | 'gameover';

interface MoveCard {
  key: string;
  isPlayer: boolean;
  detail: TutorialMoveDetail;
}

// ── Helpers (same pattern as LiveBoard) ──────────────────────────────────────
function getLegalTargets(fen: string, square: Square): Square[] {
  try {
    const ch = new Chess(fen);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (ch.moves({ square, verbose: true }) as any[]).map((m) => m.to as Square);
  } catch { return []; }
}

function isMyPiece(fen: string, sq: Square, color: 'white' | 'black'): boolean {
  try {
    const ch = new Chess(fen);
    const p = ch.get(sq);
    if (!p) return false;
    return color === 'white' ? p.color === 'w' : p.color === 'b';
  } catch { return false; }
}

function isMyTurn(fen: string, color: 'white' | 'black'): boolean {
  const turn = fen.split(' ')[1];
  return color === 'white' ? turn === 'w' : turn === 'b';
}

function isPromotion(fen: string, from: Square, to: Square): boolean {
  try {
    const ch = new Chess(fen);
    const p = ch.get(from);
    if (!p || p.type !== 'p') return false;
    return (p.color === 'w' && to[1] === '8') || (p.color === 'b' && to[1] === '1');
  } catch { return false; }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function TutorialPage() {
  const boardTheme = useBoardThemeStore((s) => s.getTheme());
  const [phase, setPhase] = useState<GamePhase>('setup');
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [difficulty, setDifficulty] = useState(3);
  const [fen, setFen] = useState(START_FEN);
  const [cards, setCards] = useState<MoveCard[]>([]);
  const [engineThinking, setEngineThinking] = useState(false);
  const [gameOverInfo, setGameOverInfo] = useState<{ winner: string; reason: string } | null>(null);
  const [hintMove, setHintMove] = useState<{ from: Square; to: Square } | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  // Wrong-move arrow (shown after inaccuracy / mistake / blunder)
  const [wrongMoveArrow, setWrongMoveArrow] = useState<[Square, Square] | null>(null);

  // Undo history — one snapshot per player move
  const [undoHistory, setUndoHistory] = useState<
    Array<{ fen: string; cards: MoveCard[]; lastMove: { from: Square; to: Square } | null }>
  >([]);

  // Click-to-move
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [optionSquares, setOptionSquares] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);

  // Resize
  const [boardWidth, setBoardWidth] = useState(480);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  // Scroll explanation panel to bottom on new card
  const cardsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    cardsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [cards]);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startWidth: boardWidth };
    const onMouseMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      const next = Math.min(800, Math.max(280, dragState.current.startWidth + ev.clientX - dragState.current.startX));
      setBoardWidth(next);
    };
    const onMouseUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [boardWidth]);

  // ── Apply a server response ───────────────────────────────────────────────
  // Returns a Promise that resolves only after all animations complete, so
  // engineThinking can remain true throughout (board stays locked).
  const ANIM_MS = 280; // keep in sync with animationDuration prop

  const applyResponse = useCallback((resp: TutorialMoveResponse): Promise<void> => {
    return new Promise((resolve) => {
      const newCards: MoveCard[] = [];
      newCards.push({ key: `${Date.now()}-player`, isPlayer: true, detail: resp.player_move });

      if (resp.engine_move) {
        // Step 1 — animate the player's move
        const pFrom = resp.player_move.uci.slice(0, 2) as Square;
        const pTo   = resp.player_move.uci.slice(2, 4) as Square;
        setLastMove({ from: pFrom, to: pTo });
        setFen(resp.fen_after_player);

        newCards.push({ key: `${Date.now()}-engine`, isPlayer: false, detail: resp.engine_move });
        setCards((prev) => [...prev, ...newCards]);

        // Step 2 — after player animation settles, animate the engine's move
        const eFrom = resp.engine_move.uci.slice(0, 2) as Square;
        const eTo   = resp.engine_move.uci.slice(2, 4) as Square;
        setTimeout(() => {
          setLastMove({ from: eFrom, to: eTo });
          setFen(resp.fen_after_engine);
          if (resp.game_over) { setGameOverInfo(resp.game_over); setPhase('gameover'); }
          // Wait for engine animation to finish before releasing the board
          setTimeout(resolve, ANIM_MS + 50);
        }, ANIM_MS + 80);
      } else {
        const pFrom = resp.player_move.uci.slice(0, 2) as Square;
        const pTo   = resp.player_move.uci.slice(2, 4) as Square;
        setLastMove({ from: pFrom, to: pTo });
        setFen(resp.fen_after_player);
        setCards((prev) => [...prev, ...newCards]);
        if (resp.game_over) { setGameOverInfo(resp.game_over); setPhase('gameover'); }
        resolve();
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Submit a player move ──────────────────────────────────────────────────
  const BAD_LABELS = ['inaccuracy', 'mistake', 'blunder'];

  const submitMove = useCallback(async (from: Square, to: Square) => {
    const uci = `${from}${to}${isPromotion(fen, from, to) ? 'q' : ''}`;
    const snapshot = { fen, cards, lastMove }; // checkpoint for undo

    setUndoHistory((prev) => [...prev, snapshot]);
    setSelectedSquare(null);
    setOptionSquares([]);
    setHintMove(null);
    setWrongMoveArrow(null);
    setEngineThinking(true);
    setLastMove({ from, to });

    try {
      const { data } = await tutorialApi.move(fen, uci, playerColor, difficulty);
      // Await the full two-step animation before releasing engineThinking
      await applyResponse(data);

      // After a bad move, silently fetch hint for the pre-move position and show arrow
      if (BAD_LABELS.includes(data.player_move.label)) {
        try {
          const { data: hintData } = await tutorialApi.hint(snapshot.fen, playerColor, difficulty);
          const arrowFrom = hintData.best_move_uci.slice(0, 2) as Square;
          const arrowTo   = hintData.best_move_uci.slice(2, 4) as Square;
          setWrongMoveArrow([arrowFrom, arrowTo]);
        } catch { /* hint failure is non-critical */ }
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
      setLastMove(null);
      // Move never landed — roll back the checkpoint we just pushed
      setUndoHistory((prev) => prev.slice(0, -1));
    } finally {
      setEngineThinking(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, cards, lastMove, playerColor, difficulty, applyResponse]);

  // ── Click-to-move ─────────────────────────────────────────────────────────
  const onSquareClick = useCallback((square: Square) => {
    if (engineThinking || phase !== 'playing') return;
    if (!isMyTurn(fen, playerColor)) return;

    // If a hint is active and user clicks the hinted from-square, auto-execute the suggested move
    if (hintMove && square === hintMove.from) {
      setHintMove(null);
      setSelectedSquare(null);
      setOptionSquares([]);
      submitMove(hintMove.from, hintMove.to);
      return;
    }

    // Any other click dismisses the hint
    if (hintMove) setHintMove(null);

    if (selectedSquare) {
      if (optionSquares.includes(square)) {
        submitMove(selectedSquare, square);
        return;
      }
      if (isMyPiece(fen, square, playerColor)) {
        const targets = getLegalTargets(fen, square);
        setSelectedSquare(square);
        setOptionSquares(targets);
        return;
      }
      setSelectedSquare(null);
      setOptionSquares([]);
      return;
    }

    if (isMyPiece(fen, square, playerColor)) {
      const targets = getLegalTargets(fen, square);
      if (targets.length > 0) {
        setSelectedSquare(square);
        setOptionSquares(targets);
      }
    }
  }, [engineThinking, phase, fen, playerColor, hintMove, selectedSquare, optionSquares, submitMove]);

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  const onDrop = useCallback((from: Square, to: Square) => {
    if (engineThinking || phase !== 'playing') return false;
    if (!isMyTurn(fen, playerColor)) return false;
    submitMove(from, to);
    return true;
  }, [engineThinking, phase, fen, playerColor, submitMove]);

  // ── Undo last move ──────────────────────────────────────────────────────
  const undoMove = useCallback(() => {
    if (undoHistory.length === 0) return;
    const prev = undoHistory[undoHistory.length - 1];
    setUndoHistory((h) => h.slice(0, -1));
    setFen(prev.fen);
    setCards(prev.cards);
    setLastMove(prev.lastMove);
    setWrongMoveArrow(null);
    setHintMove(null);
    setSelectedSquare(null);
    setOptionSquares([]);
    if (phase === 'gameover') setPhase('playing');
  }, [undoHistory, phase]);

  // ── Hint ──────────────────────────────────────────────────────────────────
  const requestHint = useCallback(async () => {
    if (hintLoading || engineThinking || phase !== 'playing') return;
    setHintLoading(true);
    setHintMove(null);
    try {
      const { data } = await tutorialApi.hint(fen, playerColor, difficulty);
      const from = data.best_move_uci.slice(0, 2) as Square;
      const to   = data.best_move_uci.slice(2, 4) as Square;
      setHintMove({ from, to });
      setSelectedSquare(null);
      setOptionSquares([]);
      toast('💡 ' + data.explanation + ' — click the green piece to play it.', { duration: 6000 });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setHintLoading(false);
    }
  }, [hintLoading, engineThinking, phase, fen, playerColor, difficulty]);

  // ── Start game ────────────────────────────────────────────────────────────
  const startGame = useCallback(async () => {
    setFen(START_FEN);
    setCards([]);
    setLastMove(null);
    setSelectedSquare(null);
    setOptionSquares([]);
    setHintMove(null);
    setWrongMoveArrow(null);
    setUndoHistory([]);
    setGameOverInfo(null);
    setPhase('playing');

    if (playerColor === 'black') {
      setEngineThinking(true);
      try {
        const { data } = await tutorialApi.engineFirstMove(difficulty);
        const from = data.uci.slice(0, 2) as Square;
        const to = data.uci.slice(2, 4) as Square;
        setLastMove({ from, to });
        setFen(data.fen_after);
        setCards([{
          key: `${Date.now()}-engine-first`,
          isPlayer: false,
          detail: {
            uci: data.uci,
            san: data.san,
            label: 'good',
            eval_before: 0,
            eval_after: 0,
            explanation: data.explanation,
          },
        }]);
      } catch (err) {
        toast.error(getErrorMessage(err));
        setPhase('setup');
      } finally {
        setEngineThinking(false);
      }
    }
  }, [playerColor, difficulty]);

  // ── Custom square styles ──────────────────────────────────────────────────
  const customSquareStyles: Record<string, CSSProperties> = {};

  if (lastMove) {
    customSquareStyles[lastMove.from] = { backgroundColor: 'rgba(255, 214, 10, 0.25)' };
    customSquareStyles[lastMove.to]   = { backgroundColor: 'rgba(255, 214, 10, 0.35)' };
  }
  if (selectedSquare) {
    customSquareStyles[selectedSquare] = { backgroundColor: 'rgba(59, 130, 246, 0.55)' };
  }
  for (const sq of optionSquares) {
    const hasEnemy = new Chess(fen).get(sq) !== null;
    customSquareStyles[sq] = hasEnemy
      ? { background: 'radial-gradient(circle, transparent 55%, rgba(59,130,246,0.6) 55%)', borderRadius: '50%' }
      : { background: 'radial-gradient(circle, rgba(59,130,246,0.6) 28%, transparent 28%)', borderRadius: '50%' };
  }
  if (hintMove) {
    customSquareStyles[hintMove.from] = { backgroundColor: 'rgba(34, 197, 94, 0.6)', cursor: 'pointer' };
    customSquareStyles[hintMove.to]   = { backgroundColor: 'rgba(34, 197, 94, 0.25)' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SETUP SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div style={s.page}>
        <div style={s.setupCard}>
          <h1 style={s.setupTitle}>♟ Tutorial Mode</h1>
          <p style={s.setupSubtitle}>
            Play against the engine. Every move — yours and the engine's — is explained in detail.
          </p>

          <div style={s.setupSection}>
            <label style={s.label}>Play as</label>
            <div style={s.colorPicker}>
              {(['white', 'black'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setPlayerColor(c)}
                  style={{
                    ...s.colorBtn,
                    ...(playerColor === c ? s.colorBtnActive : {}),
                  }}
                >
                  {c === 'white' ? '♔ White' : '♚ Black'}
                </button>
              ))}
            </div>
          </div>

          <div style={s.setupSection}>
            <label style={s.label}>
              Difficulty — <strong style={{ color: '#f8fafc' }}>{DIFFICULTY_LABELS[difficulty]}</strong>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              style={s.slider}
            />
            <div style={s.sliderLabels}>
              {[1, 2, 3, 4, 5].map((d) => (
                <span key={d} style={{ color: d === difficulty ? '#60a5fa' : '#475569', fontSize: 12 }}>
                  {DIFFICULTY_LABELS[d]}
                </span>
              ))}
            </div>
          </div>

          <button onClick={startGame} style={s.startBtn}>
            Start Game
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GAME SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  const myTurn = isMyTurn(fen, playerColor) && !engineThinking && phase === 'playing';

  return (
    <div style={s.page}>
      {/* Header bar */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#f8fafc' }}>♟ Tutorial</span>
          <span style={s.badge}>{DIFFICULTY_LABELS[difficulty]}</span>
          <span style={s.badge}>{playerColor === 'white' ? '♔ White' : '♚ Black'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={requestHint}
            disabled={!myTurn || hintLoading}
            style={{ ...s.hintBtn, opacity: !myTurn ? 0.4 : 1 }}
          >
            {hintLoading ? '…' : '💡 Hint'}
          </button>
          <button
            onClick={undoMove}
            disabled={undoHistory.length === 0 || engineThinking}
            title="Undo last move"
            style={{ ...s.undoBtn, opacity: undoHistory.length === 0 || engineThinking ? 0.4 : 1 }}
          >
            ↩ Undo
          </button>
          <button onClick={() => setPhase('setup')} style={s.newGameBtn}>
            New Game
          </button>
        </div>
      </div>

      <div style={s.gameLayout}>
        {/* Left: board column */}
        <div style={s.boardColumn}>
          {/* Status banner */}
          <div style={s.statusBar}>
            {phase === 'gameover' && gameOverInfo ? (
              <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                Game over — {gameOverInfo.winner === 'draw'
                  ? `Draw by ${gameOverInfo.reason}`
                  : `${gameOverInfo.winner === playerColor ? '🎉 You win' : 'Engine wins'} by ${gameOverInfo.reason}`}
              </span>
            ) : engineThinking ? (
              <span style={{ color: '#60a5fa' }}>
                <span style={s.spinner} /> Engine is thinking…
              </span>
            ) : myTurn ? (
              <span style={{ color: '#4ade80' }}>Your turn</span>
            ) : (
              <span style={{ color: '#94a3b8' }}>Waiting…</span>
            )}
          </div>

          {/* Chessboard with resize grip */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{ borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 32px rgba(0,0,0,0.5)' }}>
              <Chessboard
                position={fen}
                boardWidth={boardWidth}
                boardOrientation={playerColor === 'black' ? 'black' : 'white'}
                onPieceDrop={onDrop}
                onSquareClick={onSquareClick}
                isDraggablePiece={({ piece }) => {
                  if (engineThinking || phase !== 'playing') return false;
                  const isWhitePiece = piece[0] === 'w';
                  return playerColor === 'white' ? isWhitePiece : !isWhitePiece;
                }}
                customSquareStyles={customSquareStyles}
                customArrows={
                  wrongMoveArrow
                    ? [[wrongMoveArrow[0], wrongMoveArrow[1], 'rgb(34,197,94)']]
                    : []
                }
                customDarkSquareStyle={{ backgroundColor: boardTheme.dark }}
                customLightSquareStyle={{ backgroundColor: boardTheme.light }}
                customBoardStyle={{ borderRadius: 0 }}
                areArrowsAllowed
                animationDuration={280}
              />
            </div>
            {/* Resize grip */}
            <div
              onMouseDown={onResizeStart}
              title="Drag to resize"
              style={s.resizeGrip}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M11 1L1 11" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M11 5L5 11" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M11 9L9 11" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>

          {/* Phase-specific bottom action */}
          {phase === 'gameover' && (
            <button onClick={() => setPhase('setup')} style={{ ...s.startBtn, marginTop: 12 }}>
              Play Again
            </button>
          )}
        </div>

        {/* Right: explanation panel */}
        <div style={s.explanationPanel}>
          <h3 style={s.panelTitle}>Move Explanations</h3>
          <div style={s.cardList}>
            {cards.length === 0 && (
              <p style={{ color: '#475569', fontSize: 13, padding: '8px 0' }}>
                Make your first move to receive feedback.
              </p>
            )}
            {cards.map((card) => (
              <div key={card.key} style={{
                ...s.moveCard,
                borderLeft: `3px solid ${LABEL_COLORS[card.detail.label as keyof typeof LABEL_COLORS] ?? '#64748b'}`,
              }}>
                <div style={s.cardHeader}>
                  <span style={{
                    ...s.cardSan,
                    color: LABEL_COLORS[card.detail.label as keyof typeof LABEL_COLORS] ?? '#e2e8f0',
                  }}>
                    {LABEL_ICONS[card.detail.label] ?? ''} {card.detail.san}
                  </span>
                  <span style={{
                    ...s.cardWho,
                    color: card.isPlayer ? '#60a5fa' : '#f97316',
                  }}>
                    {card.isPlayer ? 'You' : 'Engine'}
                  </span>
                </div>
                <p style={s.cardExplanation}>{card.detail.explanation}</p>
                <div style={s.cardEval}>
                  Eval: {card.detail.eval_after >= 0 ? '+' : ''}{(card.detail.eval_after / 100).toFixed(2)}
                </div>
              </div>
            ))}
            <div ref={cardsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1300,
    margin: '0 auto',
    padding: '24px 20px',
    minHeight: 'calc(100vh - 56px)',
    boxSizing: 'border-box',
  },
  setupCard: {
    maxWidth: 520,
    margin: '60px auto 0',
    background: '#1e293b',
    borderRadius: 16,
    padding: '40px 48px',
    border: '1px solid #334155',
    boxShadow: '0 8px 48px rgba(0,0,0,0.4)',
  },
  setupTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: '#f8fafc',
    margin: '0 0 8px',
  },
  setupSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    margin: '0 0 32px',
    lineHeight: 1.6,
  },
  setupSection: {
    marginBottom: 28,
  },
  label: {
    display: 'block',
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 10,
  },
  colorPicker: {
    display: 'flex',
    gap: 12,
  },
  colorBtn: {
    flex: 1,
    padding: '10px 0',
    borderRadius: 8,
    border: '2px solid #334155',
    background: '#0f172a',
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  colorBtnActive: {
    border: '2px solid #3b82f6',
    color: '#f8fafc',
    background: '#1e3a5f',
  },
  slider: {
    width: '100%',
    accentColor: '#3b82f6',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  startBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 10,
    border: 'none',
    background: '#3b82f6',
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 6,
    padding: '3px 10px',
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 600,
  },
  hintBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid #365314',
    background: '#14532d',
    color: '#86efac',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  undoBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid #44403c',
    background: '#1c1917',
    color: '#d6d3d1',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  newGameBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid #334155',
    background: '#1e293b',
    color: '#94a3b8',
    fontSize: 14,
    cursor: 'pointer',
  },
  gameLayout: {
    display: 'flex',
    gap: 24,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  boardColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: '#1e293b',
    borderRadius: 8,
    border: '1px solid #334155',
    fontSize: 14,
    minHeight: 36,
  },
  spinner: {
    display: 'inline-block',
    width: 12,
    height: 12,
    border: '2px solid #334155',
    borderTop: '2px solid #60a5fa',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginRight: 6,
  },
  resizeGrip: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    cursor: 'nwse-resize',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: '3px',
    zIndex: 10,
  },
  explanationPanel: {
    flex: 1,
    minWidth: 300,
    maxWidth: 440,
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 12,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '80vh',
  },
  panelTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    margin: '0 0 12px',
  },
  cardList: {
    overflowY: 'auto',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  moveCard: {
    background: '#0f172a',
    borderRadius: 8,
    padding: '10px 12px',
    borderLeft: '3px solid #475569',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardSan: {
    fontWeight: 700,
    fontSize: 15,
    fontFamily: 'monospace',
  },
  cardWho: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  cardExplanation: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 1.6,
    margin: 0,
  },
  cardEval: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 6,
    fontFamily: 'monospace',
  },
};
