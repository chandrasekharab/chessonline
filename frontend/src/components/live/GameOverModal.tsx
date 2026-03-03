import { useNavigate } from 'react-router-dom';
import { GameOverInfo } from '../../store/liveGameStore';

interface GameOverModalProps {
  info: GameOverInfo;
  myColor: 'white' | 'black' | null;
  onRematch?: () => void;
  onClose: () => void;
}

const TERMINATION_LABELS: Record<string, string> = {
  normal: 'by checkmate',
  resignation: 'by resignation',
  timeout: 'on time',
  draw_agreement: 'by agreement',
  abandoned: '— game abandoned',
};

export default function GameOverModal({ info, myColor, onClose }: GameOverModalProps) {
  const navigate = useNavigate();

  const isDraw = info.winner === 'draw';
  const iWin = info.winner === myColor;
  const resultText = isDraw ? 'Draw' : iWin ? 'You Win!' : 'You Lose';
  const resultColor = isDraw ? '#fbbf24' : iWin ? '#22c55e' : '#ef4444';
  const terminationText = TERMINATION_LABELS[info.termination] ?? '';

  const myRatingChange =
    myColor === 'white' ? info.white_rating_change : info.black_rating_change;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '16px',
          padding: '40px',
          textAlign: 'center',
          minWidth: '320px',
          maxWidth: '420px',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '8px' }}>
          {isDraw ? '🤝' : iWin ? '🏆' : '💀'}
        </div>
        <h2 style={{ fontSize: '32px', fontWeight: 800, color: resultColor, margin: '0 0 8px' }}>
          {resultText}
        </h2>
        <p style={{ color: '#94a3b8', marginBottom: '16px', textTransform: 'capitalize' }}>
          {terminationText}
        </p>

        {myRatingChange !== undefined && (
          <div
            style={{
              background: '#0f172a',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '24px',
              fontSize: '18px',
              fontWeight: 600,
              color: myRatingChange >= 0 ? '#22c55e' : '#ef4444',
            }}
          >
            {myRatingChange >= 0 ? '+' : ''}{myRatingChange} ELO
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {info.analysis_game_id && (
            <button
              onClick={() => navigate(`/games/${info.analysis_game_id}`)}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              View Analysis
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              background: '#334155',
              color: '#e2e8f0',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            New Game
          </button>
        </div>
      </div>
    </div>
  );
}
