import type { MoveLabel } from '../../types';
import { LABEL_COLORS, LABEL_DISPLAY } from '../../types';

interface Props {
  summary: Record<string, number>;
}

const SUMMARY_LABELS: MoveLabel[] = ['blunder', 'mistake', 'inaccuracy', 'missed_win', 'excellent', 'best', 'good'];

export default function AnalysisSummary({ summary }: Props) {
  const total = Object.values(summary).reduce((a, b) => a + b, 0);

  return (
    <div style={styles.container}>
      {SUMMARY_LABELS.map((label) => {
        const count = summary[label] ?? 0;
        if (count === 0 && label === 'good') return null;
        return (
          <div key={label} style={styles.item}>
            <div style={{ ...styles.dot, background: LABEL_COLORS[label] }} />
            <div style={styles.labelText}>{LABEL_DISPLAY[label]}</div>
            <div style={styles.count}>{count}</div>
          </div>
        );
      })}
      <div style={styles.item}>
        <div style={{ ...styles.dot, background: '#475569' }} />
        <div style={styles.labelText}>Total</div>
        <div style={styles.count}>{total}</div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 6,
    padding: '6px 12px',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  labelText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  count: {
    fontSize: 15,
    fontWeight: 700,
    color: '#f1f5f9',
    minWidth: 20,
    textAlign: 'right',
  },
};
