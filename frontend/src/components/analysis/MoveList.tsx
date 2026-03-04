import { useRef, useEffect } from 'react';
import type { AnalysisMove, MoveLabel } from '../../types';
import { LABEL_COLORS, LABEL_DISPLAY } from '../../types';

interface Props {
  moves: AnalysisMove[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onHoverMove?: (idx: number | null) => void;
}

const LABEL_ICONS: Record<MoveLabel, string> = {
  best: '★', excellent: '!', good: '', inaccuracy: '?!',
  mistake: '?', blunder: '??', missed_win: '☆',
};

const LEGEND_LABELS: MoveLabel[] = ['blunder', 'mistake', 'inaccuracy', 'excellent', 'best'];

export default function MoveList({ moves, currentIndex, onSelect, onHoverMove }: Props) {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentIndex]);

  const pairs: Array<{ white?: AnalysisMove; black?: AnalysisMove; number: number }> = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({ number: moves[i].move_number, white: moves[i], black: moves[i + 1] });
  }

  const renderMove = (move: AnalysisMove | undefined, index: number) => {
    if (!move) return <div style={styles.cell} />;
    const isActive = index === currentIndex;
    const color = LABEL_COLORS[move.label];
    const icon = LABEL_ICONS[move.label];
    return (
      <div
        ref={isActive ? activeRef : undefined}
        style={{
          ...styles.cell,
          ...(isActive ? styles.cellActive : {}),
        }}
        onClick={() => onSelect(index)}
        onMouseEnter={() => onHoverMove?.(index)}
        onMouseLeave={() => onHoverMove?.(null)}
        title={LABEL_DISPLAY[move.label]}
        role="button"
      >
        {icon && <span style={{ color, fontSize: 10, fontWeight: 700, flexShrink: 0, minWidth: 14 }}>{icon}</span>}
        <span style={{ ...styles.san, color: isActive ? 'var(--text-1)' : 'var(--text-2)' }}>{move.move}</span>
        {move.eval_after !== null && (
          <span style={styles.eval}>
            {move.eval_after >= 0 ? '+' : ''}{(move.eval_after / 100).toFixed(1)}
          </span>
        )}
      </div>
    );
  };

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>Moves</span>
        <span style={styles.headerCount}>{Math.ceil(moves.length / 2)} moves</span>
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        {LEGEND_LABELS.map((l) => {
          const cnt = moves.filter((m) => m.label === l).length;
          if (cnt === 0) return null;
          return (
            <span key={l} style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: LABEL_COLORS[l] }} />
              <span style={{ color: 'var(--text-4)', fontSize: 11 }}>{cnt} {LABEL_DISPLAY[l]}</span>
            </span>
          );
        })}
      </div>

      {/* Move grid */}
      <div style={styles.grid}>
        {/* Column headers */}
        <div style={styles.colHeader}>
          <div style={styles.numCol} />
          <div style={{ flex: 1, ...styles.colHeaderCell }}>White</div>
          <div style={{ flex: 1, ...styles.colHeaderCell }}>Black</div>
        </div>
        {pairs.map((pair, i) => (
          <div key={pair.number} style={{ ...styles.row, ...(i % 2 === 0 ? styles.rowEven : {}) }}>
            <div style={styles.numCol}>{pair.number}.</div>
            {renderMove(pair.white, i * 2)}
            {renderMove(pair.black, i * 2 + 1)}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root:   { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexShrink: 0 },
  headerTitle: { fontSize: 13, fontWeight: 600, color: 'var(--text-3)' },
  headerCount: { fontSize: 11, color: 'var(--text-5)', background: 'var(--bg-card)', padding: '2px 8px', borderRadius: 9 },
  legend: { display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginBottom: 10, flexShrink: 0 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 4 },
  legendDot:  { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },

  grid: {
    flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 8, overflow: 'hidden', fontFamily: 'monospace', fontSize: 13,
  },
  colHeader: {
    display: 'flex', alignItems: 'center',
    background: 'var(--bg-drawer)', borderBottom: '1px solid var(--border)',
  },
  colHeaderCell: { padding: '5px 10px', fontSize: 10, fontWeight: 700, color: 'var(--text-5)', letterSpacing: '0.06em', textTransform: 'uppercase' as const },
  row:     { display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--bg-card)' },
  rowEven: { background: 'var(--bg-surface)' },
  numCol:  { width: 42, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '5px 8px', color: 'var(--text-5)', fontSize: 11, borderRight: '1px solid var(--bg-card)' },
  cell: {
    flex: 1, display: 'flex', alignItems: 'center', gap: 4,
    padding: '6px 8px', cursor: 'pointer', minHeight: 34,
    transition: 'background 0.12s',
    borderRight: '1px solid var(--bg-card)',
  },
  cellActive: { background: '#1e3a5f', outline: '1px solid #2563eb' },
  san:  { fontWeight: 600, fontSize: 13 },
  eval: { marginLeft: 'auto', fontSize: 10, color: 'var(--text-5)', fontFamily: 'monospace' },
};
