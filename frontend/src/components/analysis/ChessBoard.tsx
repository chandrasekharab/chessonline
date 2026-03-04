import { useState, useRef, useCallback, CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import { useBoardThemeStore } from '../../store/boardThemeStore';

/** Convert a square name (e.g. "e4") to SVG pixel coords at the center of that square. */
function squareToXY(sq: string, boardWidth: number, orientation: 'white' | 'black'): { x: number; y: number } {
  const file = sq.charCodeAt(0) - 97; // a=0 … h=7
  const rank = parseInt(sq[1], 10) - 1; // 1=0 … 8=7
  const s = boardWidth / 8;
  if (orientation === 'white') {
    return { x: (file + 0.5) * s, y: (7 - rank + 0.5) * s };
  }
  return { x: (7 - file + 0.5) * s, y: (rank + 0.5) * s };
}

interface Props {
  fen: string;
  orientation?: 'white' | 'black';
  lastMove?: { from: string; to: string };
  /** Override the arrow/square highlight colour (hex or rgba). Defaults to gold. */
  highlightColor?: string;
  /** Opponent's best response square path — drawn as a contrasting cyan arrow. */
  opponentMove?: { from: string; to: string };
  /** Controlled board width — lift state to parent so EvaluationBar stays in sync */
  boardWidth?: number;
  onBoardWidthChange?: (w: number) => void;
}

export default function ChessBoardView({ fen, orientation = 'white', lastMove, highlightColor, opponentMove, boardWidth: controlledWidth, onBoardWidthChange }: Props) {
  const theme = useBoardThemeStore((s) => s.getTheme());
  const [internalWidth, setInternalWidth] = useState(420);
  const boardWidth = controlledWidth ?? internalWidth;
  const setBoardWidth = (w: number) => { setInternalWidth(w); onBoardWidthChange?.(w); };
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragState.current = { startX: e.clientX, startWidth: boardWidth };
      const onMouseMove = (ev: MouseEvent) => {
        if (!dragState.current) return;
        const delta = ev.clientX - dragState.current.startX;
        const next = Math.min(800, Math.max(280, dragState.current.startWidth + delta));
        setBoardWidth(next);
      };
      const onMouseUp = () => {
        dragState.current = null;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [boardWidth]
  );

  // Build square highlights + arrows
  const customSquareStyles: Record<string, CSSProperties> = {};
  const customArrows: [string, string, string][] = [];

  // ── Player's move (label-coloured) ──────────────────────────────────────
  if (lastMove) {
    if (highlightColor) {
      customSquareStyles[lastMove.from] = { background: highlightColor + '40' };
      customSquareStyles[lastMove.to]   = { background: highlightColor + '70' };
      customArrows.push([lastMove.from, lastMove.to, highlightColor]);
    } else {
      customSquareStyles[lastMove.from] = { background: 'rgba(255, 255, 0, 0.3)' };
      customSquareStyles[lastMove.to]   = { background: 'rgba(255, 255, 0, 0.4)' };
      customArrows.push([lastMove.from, lastMove.to, 'rgba(255,200,0,0.8)']);
    }
  }

  // ── Opponent's response (cyan) — square tints only; arrow drawn manually ─
  const OPPONENT_COLOR = '#06b6d4';
  if (opponentMove) {
    customSquareStyles[opponentMove.from] = {
      ...customSquareStyles[opponentMove.from],
      outline: `2px dashed ${OPPONENT_COLOR}88`,
      outlineOffset: '-2px',
    };
    customSquareStyles[opponentMove.to] = {
      ...customSquareStyles[opponentMove.to],
      background: OPPONENT_COLOR + '50',
    };
    // NOT pushed to customArrows — drawn as dashed SVG overlay below
  }

  // ── Dashed SVG arrow for opponent best move ─────────────────────────────
  let dashedArrow: React.ReactNode = null;
  if (opponentMove) {
    const from = squareToXY(opponentMove.from, boardWidth, orientation);
    const to   = squareToXY(opponentMove.to,   boardWidth, orientation);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    // shorten line so it ends before square centre (leave room for arrowhead)
    const headLen = boardWidth * 0.07;
    const shaftEndX = to.x - ux * headLen;
    const shaftEndY = to.y - uy * headLen;
    // arrowhead points
    const perpX = -uy, perpY = ux;
    const hw = headLen * 0.42;
    const pts = [
      `${to.x},${to.y}`,
      `${shaftEndX + perpX * hw},${shaftEndY + perpY * hw}`,
      `${shaftEndX - perpX * hw},${shaftEndY - perpY * hw}`,
    ].join(' ');
    const dashLen = boardWidth * 0.042;
    dashedArrow = (
      <svg
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20 }}
        width={boardWidth}
        height={boardWidth}
      >
        {/* Dashed shaft */}
        <line
          x1={from.x} y1={from.y} x2={shaftEndX} y2={shaftEndY}
          stroke={OPPONENT_COLOR}
          strokeWidth={boardWidth * 0.022}
          strokeDasharray={`${dashLen} ${dashLen * 0.65}`}
          strokeLinecap="round"
          opacity={0.85}
        />
        {/* Solid arrowhead */}
        <polygon points={pts} fill={OPPONENT_COLOR} opacity={0.85} />
      </svg>
    );
  }

  return (
    <div className="chess-view-board" style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      {/* Thin player-move arrow shafts */}
      <style>{`.chess-view-board svg g[data-arrow] rect{transform-box:fill-box;transform-origin:center;transform:scaleY(0.55)}.chess-view-board svg g[data-arrow] polygon{transform-box:fill-box;transform-origin:bottom center;transform:scaleX(0.55)}`}</style>
      <Chessboard
        position={fen}
        boardWidth={boardWidth}
        boardOrientation={orientation}
        areArrowsAllowed={false}
        isDraggablePiece={() => false}
        customSquareStyles={customSquareStyles}
        customArrows={customArrows as any}
        customBoardStyle={{
          borderRadius: 6,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
        customDarkSquareStyle={{ backgroundColor: theme.dark }}
        customLightSquareStyle={{ backgroundColor: theme.light }}
      />
      {dashedArrow}
      {/* Resize grip */}
      <div
        onMouseDown={onResizeStart}
        title="Drag to resize board"
        style={{
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
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M11 1L1 11" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M11 5L5 11" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M11 9L9 11" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  );
}
