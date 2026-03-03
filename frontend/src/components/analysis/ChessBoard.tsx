import { useState, useRef, useCallback, CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import { useBoardThemeStore } from '../../store/boardThemeStore';

interface Props {
  fen: string;
  orientation?: 'white' | 'black';
  lastMove?: { from: string; to: string };
}

export default function ChessBoardView({ fen, orientation = 'white', lastMove }: Props) {
  const theme = useBoardThemeStore((s) => s.getTheme());
  const [boardWidth, setBoardWidth] = useState(400);
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

  const customSquareStyles: Record<string, CSSProperties> = {};
  if (lastMove) {
    customSquareStyles[lastMove.from] = { background: 'rgba(255, 255, 0, 0.3)' };
    customSquareStyles[lastMove.to]   = { background: 'rgba(255, 255, 0, 0.4)' };
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      <Chessboard
        position={fen}
        boardWidth={boardWidth}
        boardOrientation={orientation}
        areArrowsAllowed={false}
        isDraggablePiece={() => false}
        customSquareStyles={customSquareStyles}
        customBoardStyle={{
          borderRadius: 6,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
        customDarkSquareStyle={{ backgroundColor: theme.dark }}
        customLightSquareStyle={{ backgroundColor: theme.light }}
      />
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
