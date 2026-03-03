import type { AnalysisMove, MoveLabel } from '../../types';
import { LABEL_COLORS, LABEL_DISPLAY } from '../../types';

interface Props {
  moves: AnalysisMove[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

const LABEL_ICONS: Record<MoveLabel, string> = {
  best: '★',
  excellent: '!',
  good: '',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
  missed_win: '☆',
};

export default function MoveList({ moves, currentIndex, onSelect }: Props) {
  // Group into pairs (white/black)
  const pairs: Array<{ white?: AnalysisMove; black?: AnalysisMove; number: number }> = [];

  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      number: moves[i].move_number,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  const renderMove = (move: AnalysisMove | undefined, index: number) => {
    if (!move) return <div style={styles.moveCell} />;
    const isActive = index === currentIndex;
    const color = LABEL_COLORS[move.label];
    const icon = LABEL_ICONS[move.label];

    return (
      <div
        style={{
          ...styles.moveCell,
          ...(isActive ? styles.moveCellActive : {}),
          color: isActive ? '#fff' : '#e2e8f0',
        }}
        onClick={() => onSelect(index)}
        title={LABEL_DISPLAY[move.label]}
        role="button"
      >
        <span style={styles.san}>{move.move}</span>
        {icon && (
          <span style={{ color, fontSize: 11, fontWeight: 700, marginLeft: 2 }}>
            {icon}
          </span>
        )}
        {move.eval_after !== null && (
          <span style={styles.evalBadge}>
            {move.eval_after >= 0 ? '+' : ''}
            {(move.eval_after / 100).toFixed(1)}
          </span>
        )}
      </div>
    );
  };

  return (
    <div>
      <h3 style={styles.heading}>Move Analysis</h3>
      <div style={styles.legend}>
        {(['blunder', 'mistake', 'inaccuracy', 'missed_win', 'excellent', 'best'] as MoveLabel[]).map(
          (l) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: LABEL_COLORS[l],
                  flexShrink: 0,
                }}
              />
              <span style={{ color: '#94a3b8' }}>{LABEL_DISPLAY[l]}</span>
            </span>
          )
        )}
      </div>
      <div style={styles.grid}>
        {pairs.map((pair, pairIndex) => (
          <div key={pair.number} style={styles.row}>
            <div style={styles.moveNum}>{pair.number}.</div>
            {renderMove(pair.white, pairIndex * 2)}
            {renderMove(pair.black, pairIndex * 2 + 1)}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: {
    fontSize: 16,
    fontWeight: 600,
    color: '#f1f5f9',
    marginBottom: 10,
  },
  legend: {
    display: 'flex',
    gap: 14,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  grid: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 8,
    overflow: 'hidden',
    fontFamily: 'monospace',
    fontSize: 14,
    maxHeight: 400,
    overflowY: 'auto',
  },
  row: {
    display: 'flex',
    alignItems: 'stretch',
    borderBottom: '1px solid #334155',
  },
  moveNum: {
    width: 44,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    padding: '6px 8px',
    color: '#475569',
    fontSize: 12,
    borderRight: '1px solid #334155',
    background: '#0f172a',
  },
  moveCell: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    padding: '6px 10px',
    cursor: 'pointer',
    gap: 4,
    minHeight: 36,
    transition: 'background 0.15s',
  },
  moveCellActive: {
    background: '#3b82f633',
    outline: '1px solid #3b82f6',
  },
  san: { fontWeight: 600 },
  evalBadge: {
    marginLeft: 'auto',
    fontSize: 11,
    color: '#64748b',
  },
};
