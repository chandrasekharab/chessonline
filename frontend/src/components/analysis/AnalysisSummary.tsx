import type { MoveLabel } from '../../types';
import { LABEL_COLORS } from '../../types';

interface Props {
  summary: Record<string, number>;
}

const STATS: { label: MoveLabel; display: string; icon: string }[] = [
  { label: 'blunder',    display: 'Blunders',    icon: '❌' },
  { label: 'mistake',    display: 'Mistakes',    icon: '⚠️' },
  { label: 'inaccuracy', display: 'Inaccuracies', icon: '🟡' },
  { label: 'missed_win', display: 'Missed Wins',  icon: '💜' },
  { label: 'excellent',  display: 'Excellent',    icon: '🟢' },
  { label: 'best',       display: 'Best',         icon: '🔵' },
];

export default function AnalysisSummary({ summary }: Props) {
  const total = Object.values(summary).reduce((a, b) => a + b, 0);

  return (
    <div style={S.strip}>
      {STATS.map(({ label, display, icon }) => {
        const count = summary[label] ?? 0;
        const color = LABEL_COLORS[label];
        return (
          <div key={label} style={S.stat}>
            <div style={{ ...S.colorBar, background: color }} />
            <div style={S.statBody}>
              <span style={{ ...S.statCount, color: count > 0 ? color : 'var(--border-mid)' }}>{count}</span>
              <span style={S.statLabel}>{icon} {display}</span>
            </div>
          </div>
        );
      })}
      <div style={{ ...S.stat, ...S.totalStat }}>
        <div style={{ ...S.colorBar, background: 'var(--border-strong)' }} />
        <div style={S.statBody}>
          <span style={{ ...S.statCount, color: 'var(--text-4)' }}>{total}</span>
          <span style={S.statLabel}>Total</span>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  strip: {
    display: 'flex', flexWrap: 'wrap', gap: 6,
  },
  stat: {
    display: 'flex', alignItems: 'stretch',
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 7, overflow: 'hidden', minWidth: 72,
  },
  totalStat: {},
  colorBar: { width: 3, flexShrink: 0 },
  statBody: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '6px 10px', gap: 1,
  },
  statCount: { fontSize: 20, fontWeight: 700, lineHeight: 1 },
  statLabel: { fontSize: 10, color: 'var(--text-5)', fontWeight: 500, whiteSpace: 'nowrap' as const },
};
