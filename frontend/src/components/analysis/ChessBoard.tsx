import { Chessboard } from 'react-chessboard';

interface Props {
  fen: string;
  orientation?: 'white' | 'black';
  lastMove?: { from: string; to: string };
}

export default function ChessBoardView({ fen, orientation = 'white', lastMove }: Props) {
  const customSquareStyles: Record<string, React.CSSProperties> = {};
  if (lastMove) {
    customSquareStyles[lastMove.from] = { background: 'rgba(255, 255, 0, 0.3)' };
    customSquareStyles[lastMove.to] = { background: 'rgba(255, 255, 0, 0.4)' };
  }

  return (
    <div style={{ width: 400, maxWidth: '100%', flexShrink: 0 }}>
      <Chessboard
        position={fen}
        boardOrientation={orientation}
        areArrowsAllowed={false}
        isDraggablePiece={() => false}
        customSquareStyles={customSquareStyles}
        customBoardStyle={{
          borderRadius: 6,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
        customDarkSquareStyle={{ backgroundColor: '#4a7c59' }}
        customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
      />
    </div>
  );
}
