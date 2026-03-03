import { useState, useCallback, useRef, CSSProperties } from 'react';
import { Chess, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useBoardThemeStore } from '../../store/boardThemeStore';

// ── Types ─────────────────────────────────────────────────────────────────────
type PieceCode = string; // e.g. 'wK', 'bN'
type BoardPosition = Record<string, PieceCode>;

// ── Constants ─────────────────────────────────────────────────────────────────
const WHITE_PIECES = [
  { code: 'wK', sym: '♔', label: 'White King' },
  { code: 'wQ', sym: '♕', label: 'White Queen' },
  { code: 'wR', sym: '♖', label: 'White Rook' },
  { code: 'wB', sym: '♗', label: 'White Bishop' },
  { code: 'wN', sym: '♘', label: 'White Knight' },
  { code: 'wP', sym: '♙', label: 'White Pawn' },
];

const BLACK_PIECES = [
  { code: 'bK', sym: '♚', label: 'Black King' },
  { code: 'bQ', sym: '♛', label: 'Black Queen' },
  { code: 'bR', sym: '♜', label: 'Black Rook' },
  { code: 'bB', sym: '♝', label: 'Black Bishop' },
  { code: 'bN', sym: '♞', label: 'Black Knight' },
  { code: 'bP', sym: '♟', label: 'Black Pawn' },
];

const ALL_PIECES = [...WHITE_PIECES, ...BLACK_PIECES];

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
  const fen = fenBoard + ' ' + turn + ' - - 0 1';
  try { new Chess(fen); return fen; } catch { return null; }
}

// Compute square label from row/col (0-indexed), respecting board flip
function rowColToSquare(row: number, col: number, flipped: boolean): Square {
  const file = flipped ? 'hgfedcba'[col] : 'abcdefgh'[col];
  const rank = flipped ? row + 1 : 8 - row;
  return (file + rank) as Square;
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
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>(initialPlayerColor);
  const [turn, setTurn] = useState<'w' | 'b'>(initialPlayerColor === 'white' ? 'w' : 'b');
  const [boardWidth] = useState(460);
  const [error, setError] = useState<string | null>(null);

  // ── Drag-from-palette state ────────────────────────────────────────────────
  const [paletteDrag, setPaletteDrag] = useState<PieceCode | null>(null);
  const [hoverSquare, setHoverSquare] = useState<string | null>(null);
  const dragPieceRef = useRef<PieceCode | null>(null);

  const flipped = playerColor === 'black';

  // ── Drag-from-palette: start ───────────────────────────────────────────────
  const onPaletteDragStart = (e: React.DragEvent, code: PieceCode) => {
    dragPieceRef.current = code;
    setPaletteDrag(code);
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:fixed;top:-999px;left:-999px;font-size:40px;line-height:1;';
    ghost.textContent = ALL_PIECES.find((p) => p.code === code)?.sym ?? '';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 20, 20);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const onPaletteDragEnd = () => {
    setPaletteDrag(null);
    setHoverSquare(null);
    dragPieceRef.current = null;
  };

  // ── Overlay cell handlers (drop targets over the board) ────────────────────
  const onOverlayDragOver = (e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setHoverSquare(rowColToSquare(row, col, flipped));
  };

  const onOverlayDrop = (row: number, col: number) => {
    const piece = dragPieceRef.current;
    if (!piece) return;
    const sq = rowColToSquare(row, col, flipped);
    setError(null);
    setPosition((prev) => ({ ...prev, [sq]: piece }));
    setPaletteDrag(null);
    setHoverSquare(null);
    dragPieceRef.current = null;
  };

  // ── Drag pieces already on the board to reposition ────────────────────────
  const onPieceDrop = useCallback((from: Square, to: Square, piece: string) => {
    setError(null);
    setPosition((prev) => {
      const next = { ...prev };
      delete next[from];
      next[to] = piece;
      return next;
    });
    return true;
  }, []);

  // ── Click a board piece to remove it ─────────────────────────────────────
  const onSquareClick = useCallback((square: Square) => {
    setError(null);
    setPosition((prev) => {
      if (!prev[square]) return prev;
      const next = { ...prev };
      delete next[square];
      return next;
    });
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

  // ── Highlight hovered square during palette drag ───────────────────────────
  const customSquareStyles: Record<string, CSSProperties> = {};
  if (hoverSquare) {
    customSquareStyles[hoverSquare] = { backgroundColor: 'rgba(59,130,246,0.55)' };
  }

  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* ── Title ── */}
        <div style={s.titleRow}>
          <h2 style={s.title}>Set Up Custom Position</h2>
          <p style={s.subtitle}>
            Drag any piece from the tray below onto the board.&nbsp;
            Drag pieces on the board to reposition them.&nbsp;
            Click a piece on the board to remove it.
          </p>
        </div>

        {/* ── Piece Tray ── */}
        <div style={s.tray}>
          <div style={s.trayGroup}>
            <p style={s.trayLabel}>White pieces</p>
            <div style={s.trayRow}>
              {WHITE_PIECES.map((p) => (
                <div
                  key={p.code}
                  title={p.label + ' — drag onto board'}
                  draggable
                  onDragStart={(e) => onPaletteDragStart(e, p.code)}
                  onDragEnd={onPaletteDragEnd}
                  style={{
                    ...s.trayPiece,
                    color: '#f8fafc',
                    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    ...(paletteDrag === p.code ? s.trayPieceDragging : {}),
                  }}
                >
                  {p.sym}
                </div>
              ))}
            </div>
          </div>

          <div style={s.traySep} />

          <div style={s.trayGroup}>
            <p style={s.trayLabel}>Black pieces</p>
            <div style={s.trayRow}>
              {BLACK_PIECES.map((p) => (
                <div
                  key={p.code}
                  title={p.label + ' — drag onto board'}
                  draggable
                  onDragStart={(e) => onPaletteDragStart(e, p.code)}
                  onDragEnd={onPaletteDragEnd}
                  style={{
                    ...s.trayPiece,
                    color: '#7dd3fc',
                    ...(paletteDrag === p.code ? s.trayPieceDragging : {}),
                  }}
                >
                  {p.sym}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={s.layout}>

          {/* ── Board with drag-overlay ── */}
          <div style={{ position: 'relative', width: boardWidth, height: boardWidth, flexShrink: 0 }}>
            <Chessboard
              position={position}
              boardWidth={boardWidth}
              boardOrientation={flipped ? 'black' : 'white'}
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

            {/* Transparent 8×8 overlay — captures palette drops */}
            {paletteDrag && (
              <div
                style={{
                  position: 'absolute',
                  top: 0, left: 0,
                  width: boardWidth, height: boardWidth,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  gridTemplateRows: 'repeat(8, 1fr)',
                  zIndex: 20,
                  cursor: 'copy',
                  borderRadius: 6,
                }}
                onDragLeave={() => setHoverSquare(null)}
              >
                {Array.from({ length: 64 }, (_, i) => {
                  const row = Math.floor(i / 8);
                  const col = i % 8;
                  return (
                    <div
                      key={i}
                      onDragOver={(e) => onOverlayDragOver(e, row, col)}
                      onDrop={() => onOverlayDrop(row, col)}
                      style={{ width: '100%', height: '100%' }}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Right panel ── */}
          <div style={s.panel}>

            {/* Play as */}
            <div style={s.section}>
              <p style={s.sectionLabel}>Play as</p>
              <div style={s.turnRow}>
                {(['white', 'black'] as const).map((c) => (
                  <button key={c} onClick={() => setPlayerColor(c)}
                    style={{ ...s.turnBtn, ...(playerColor === c ? s.turnBtnActive : {}) }}>
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
                  <button key={t} onClick={() => setTurn(t)}
                    style={{ ...s.turnBtn, ...(turn === t ? s.turnBtnActive : {}) }}>
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

            {/* Hint card */}
            <div style={s.hintBox}>
              <p style={s.hintText}>
                💡 <strong>Drag</strong> pieces from the tray onto the board.<br />
                <strong>Drag</strong> board pieces to reposition them.<br />
                <strong>Click</strong> a board piece to remove it.
              </p>
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
  tray: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 12,
    padding: '14px 20px',
    flexWrap: 'wrap',
  },
  trayGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  trayLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#64748b',
  },
  trayRow: {
    display: 'flex',
    gap: 6,
  },
  trayPiece: {
    fontSize: 36,
    lineHeight: 1,
    padding: '6px 8px',
    background: '#0f172a',
    border: '2px solid #334155',
    borderRadius: 8,
    cursor: 'grab',
    userSelect: 'none',
    transition: 'border-color 0.15s, transform 0.1s, opacity 0.1s',
  },
  trayPieceDragging: {
    opacity: 0.4,
    borderColor: '#3b82f6',
    transform: 'scale(0.9)',
  },
  traySep: {
    width: 1,
    alignSelf: 'stretch',
    background: '#334155',
    margin: '4px 0',
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
    maxWidth: 300,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
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
  hintBox: {
    padding: '10px 14px',
    background: '#0f1f0f',
    border: '1px solid #166534',
    borderRadius: 8,
  },
  hintText: {
    margin: 0,
    fontSize: 12,
    color: '#86efac',
    lineHeight: 1.7,
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
