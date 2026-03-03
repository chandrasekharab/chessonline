import { useState, useCallback, CSSProperties } from 'react';
import { Chess, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useBoardThemeStore } from '../../store/boardThemeStore';

// ── Types ─────────────────────────────────────────────────────────────────────
type PieceCode = string; // e.g. 'wK', 'bN'
type BoardPosition = Record<string, PieceCode>;

// ── Constants ─────────────────────────────────────────────────────────────────
const PALETTE = [
  { code: 'wK', sym: '♔', label: 'White King' },
  { code: 'wQ', sym: '♕', label: 'White Queen' },
  { code: 'wR', sym: '♖', label: 'White Rook' },
  { code: 'wB', sym: '♗', label: 'White Bishop' },
  { code: 'wN', sym: '♘', label: 'White Knight' },
  { code: 'wP', sym: '♙', label: 'White Pawn' },
  { code: 'bK', sym: '♚', label: 'Black King' },
  { code: 'bQ', sym: '♛', label: 'Black Queen' },
  { code: 'bR', sym: '♜', label: 'Black Rook' },
  { code: 'bB', sym: '♝', label: 'Black Bishop' },
  { code: 'bN', sym: '♞', label: 'Black Knight' },
  { code: 'bP', sym: '♟', label: 'Black Pawn' },
];

const START_POS: BoardPosition = {
  a1: 'wR', b1: 'wN', c1: 'wB', d1: 'wQ', e1: 'wK', f1: 'wB', g1: 'wN', h1: 'wR',
  a2: 'wP', b2: 'wP', c2: 'wP', d2: 'wP', e2: 'wP', f2: 'wP', g2: 'wP', h2: 'wP',
  a7: 'bP', b7: 'bP', c7: 'bP', d7: 'bP', e7: 'bP', f7: 'bP', g7: 'bP', h7: 'bP',
  a8: 'bR', b8: 'bN', c8: 'bB', d8: 'bQ', e8: 'bK', f8: 'bB', g8: 'bN', h8: 'bR',
};

// ── FEN helpers ───────────────────────────────────────────────────────────────
function positionToFen(pos: BoardPosition, turn: 'w' | 'b'): string | null {
  const files = 'abcdefgh';
  let fenBoard = '';
  for (let rank = 8; rank >= 1; rank--) {
    let empty = 0;
    for (let fi = 0; fi < 8; fi++) {
      const sq = files[fi] + rank;
      const piece = pos[sq];
      if (piece) {
        if (empty > 0) { fenBoard += empty; empty = 0; }
        fenBoard += piece[0] === 'w' ? piece[1].toUpperCase() : piece[1].toLowerCase();
      } else {
        empty++;
      }
    }
    if (empty > 0) fenBoard += empty;
    if (rank > 1) fenBoard += '/';
  }
  const fen = `${fenBoard} ${turn} - - 0 1`;
  try { new Chess(fen); return fen; } catch { return null; }
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  initialPlayerColor: 'white' | 'black';
  onConfirm: (fen: string, playerColor: 'white' | 'black') => void;
  onCancel: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PositionSetupBoard({ initialPlayerColor, onConfirm, onCancel }: Props) {
  const theme = useBoardThemeStore((s) => s.getTheme());
  const [position, setPosition] = useState<BoardPosition>({ ...START_POS });
  const [brush, setBrush] = useState<PieceCode | null>(null); // null = eraser
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>(initialPlayerColor);
  const [turn, setTurn] = useState<'w' | 'b'>(initialPlayerColor === 'white' ? 'w' : 'b');
  const [boardWidth] = useState(440);
  const [error, setError] = useState<string | null>(null);

  // ── Place / remove piece on click ──────────────────────────────────────────
  const onSquareClick = useCallback((square: Square) => {
    setError(null);
    setPosition((prev) => {
      const next = { ...prev };
      if (brush === null || prev[square] === brush) {
        delete next[square]; // eraser, or clicking placed piece again removes it
      } else {
        next[square] = brush;
      }
      return next;
    });
  }, [brush]);

  // ── Drag pieces around the board during setup ──────────────────────────────
  const onPieceDrop = useCallback((from: Square, to: Square, piece: string) => {
    setError(null);
    setPosition((prev) => {
      const next = { ...prev };
      delete next[from];
      next[to] = piece; // react-chessboard passes piece as 'wK', 'bN' etc.
      return next;
    });
    return true;
  }, []);

  const handleClear = () => { setPosition({}); setError(null); };
  const handleReset = () => { setPosition({ ...START_POS }); setError(null); };

  const handleConfirm = () => {
    const fen = positionToFen(position, turn);
    if (!fen) {
      setError('Invalid position — both sides must have exactly one king, and no pawns on ranks 1 or 8.');
      return;
    }
    onConfirm(fen, playerColor);
  };

  // ── Highlight selected brush square ───────────────────────────────────────
  const customSquareStyles: Record<string, CSSProperties> = {};
  if (brush) {
    // faint green on every square that already has the selected piece (shows where it's placed)
    Object.entries(position).forEach(([sq, pc]) => {
      if (pc === brush) customSquareStyles[sq] = { backgroundColor: 'rgba(34,197,94,0.3)' };
    });
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        {/* ── Title ── */}
        <div style={s.titleRow}>
          <h2 style={s.title}>Set Up Custom Position</h2>
          <p style={s.subtitle}>
            Select a piece from the palette, then click a square to place it.
            Click an occupied square to remove it. Drag pieces to reposition.
          </p>
        </div>

        <div style={s.layout}>
          {/* ── Board ── */}
          <div>
            <Chessboard
              position={position}
              boardWidth={boardWidth}
              boardOrientation={playerColor === 'black' ? 'black' : 'white'}
              onSquareClick={onSquareClick}
              onPieceDrop={onPieceDrop}
              isDraggablePiece={() => true}
              customDarkSquareStyle={{ backgroundColor: theme.dark }}
              customLightSquareStyle={{ backgroundColor: theme.light }}
              customBoardStyle={{ borderRadius: 6, boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
              customSquareStyles={customSquareStyles}
              areArrowsAllowed={false}
              animationDuration={80}
            />
          </div>

          {/* ── Right panel ── */}
          <div style={s.panel}>
            {/* Piece palette */}
            <div style={s.section}>
              <p style={s.sectionLabel}>Piece Palette</p>
              <div style={s.paletteGrid}>
                {PALETTE.map((p) => (
                  <button
                    key={p.code}
                    title={p.label}
                    onClick={() => setBrush(brush === p.code ? null : p.code)}
                    style={{
                      ...s.palBtn,
                      ...(brush === p.code ? s.palBtnActive : {}),
                      color: p.code[0] === 'w' ? '#f8fafc' : '#94a3b8',
                    }}
                  >
                    {p.sym}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setBrush(null)}
                style={{ ...s.eraserBtn, ...(brush === null ? s.eraserBtnActive : {}) }}
              >
                ✕ Eraser
              </button>
              {brush && (
                <p style={s.brushHint}>
                  Placing: {PALETTE.find((p) => p.code === brush)?.label}
                </p>
              )}
            </div>

            {/* Play as */}
            <div style={s.section}>
              <p style={s.sectionLabel}>Play as</p>
              <div style={s.turnRow}>
                {(['white', 'black'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setPlayerColor(c)}
                    style={{ ...s.turnBtn, ...(playerColor === c ? s.turnBtnActive : {}) }}
                  >
                    {c === 'white' ? '♔ White' : '♚ Black'}
                  </button>
                ))}
              </div>
            </div>

            {/* Side to Move */}
            <div style={s.section}>
              <p style={s.sectionLabel}>Side to Move First</p>
              <div style={s.turnRow}>
                {(['w', 'b'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTurn(t)}
                    style={{ ...s.turnBtn, ...(turn === t ? s.turnBtnActive : {}) }}
                  >
                    {t === 'w' ? '♔ White' : '♚ Black'}
                  </button>
                ))}
              </div>
            </div>

            {/* Board controls */}
            <div style={s.section}>
              <p style={s.sectionLabel}>Board</p>
              <div style={s.btnRow}>
                <button onClick={handleReset} style={s.ghostBtn}>↺ Reset to Start</button>
                <button onClick={handleClear} style={s.ghostBtn}>⬜ Clear Board</button>
              </div>
            </div>

            {/* Error */}
            {error && <p style={s.errorMsg}>{error}</p>}

            {/* Actions */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={handleConfirm} style={s.playBtn}>
                ▶ Play This Position
              </button>
              <button onClick={onCancel} style={s.cancelBtn}>
                ← Back to Setup
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '24px 20px',
    boxSizing: 'border-box',
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  titleRow: {
    borderBottom: '1px solid #1e293b',
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#f8fafc',
    margin: '0 0 6px',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 13,
    margin: 0,
    lineHeight: 1.6,
  },
  layout: {
    display: 'flex',
    gap: 28,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  panel: {
    flex: 1,
    minWidth: 240,
    maxWidth: 320,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    minHeight: 440,
  },
  section: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '14px 16px',
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    margin: '0 0 10px',
  },
  paletteGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 6,
    marginBottom: 10,
  },
  palBtn: {
    fontSize: 22,
    background: '#0f172a',
    border: '2px solid #334155',
    borderRadius: 6,
    cursor: 'pointer',
    padding: '4px 0',
    lineHeight: 1,
    transition: 'border-color 0.15s, background 0.15s',
  },
  palBtnActive: {
    border: '2px solid #3b82f6',
    background: '#1e3a5f',
  },
  eraserBtn: {
    width: '100%',
    padding: '6px',
    background: '#0f172a',
    border: '2px solid #334155',
    borderRadius: 6,
    color: '#64748b',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 2,
  },
  eraserBtnActive: {
    border: '2px solid #ef4444',
    color: '#ef4444',
    background: '#1f0a0a',
  },
  brushHint: {
    margin: '8px 0 0',
    fontSize: 12,
    color: '#4ade80',
    lineHeight: 1.4,
  },
  turnRow: {
    display: 'flex',
    gap: 8,
  },
  turnBtn: {
    flex: 1,
    padding: '8px 0',
    background: '#0f172a',
    border: '2px solid #334155',
    borderRadius: 6,
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  turnBtnActive: {
    border: '2px solid #3b82f6',
    color: '#f8fafc',
    background: '#1e3a5f',
  },
  btnRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  ghostBtn: {
    padding: '7px 12px',
    background: 'transparent',
    border: '1px solid #334155',
    borderRadius: 7,
    color: '#94a3b8',
    fontSize: 13,
    cursor: 'pointer',
  },
  errorMsg: {
    marginTop: 4,
    padding: '8px 12px',
    background: '#1f0a0a',
    border: '1px solid #7f1d1d',
    borderRadius: 7,
    color: '#fca5a5',
    fontSize: 13,
    lineHeight: 1.5,
  },
  playBtn: {
    padding: '13px',
    background: '#16a34a',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '10px',
    background: 'transparent',
    border: '1px solid #334155',
    borderRadius: 8,
    color: '#64748b',
    fontSize: 14,
    cursor: 'pointer',
  },
};
