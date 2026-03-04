interface Props {
  evalCp: number;
  /** Height in pixels — should match the board width since boards are square */
  height?: number;
}

export default function EvaluationBar({ evalCp, height = 420 }: Props) {
  const clamped = Math.max(-1500, Math.min(1500, evalCp));
  const whitePercent = 50 + (clamped / 1500) * 50;

  const label =
    evalCp >= 0
      ? evalCp >= 30000 ? 'M' : `+${(evalCp / 100).toFixed(1)}`
      : evalCp <= -30000 ? '-M' : (evalCp / 100).toFixed(1);

  return (
    <div style={{ ...styles.container, height }}>
      <span style={{ ...styles.label, color: clamped <= 0 ? '#f8fafc' : '#1a1a2e' }}>
        {label}
      </span>
      <div style={styles.bar}>
        <div style={{ ...styles.black, height: `${100 - whitePercent}%` }} />
        <div style={{ ...styles.white, height: `${whitePercent}%` }} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    width: 28, flexShrink: 0,
  },
  label: {
    fontSize: 11, fontWeight: 700, marginBottom: 4, fontFamily: 'monospace',
  },
  bar: {
    flex: 1, width: '100%', borderRadius: 4, overflow: 'hidden',
    display: 'flex', flexDirection: 'column', border: '1px solid var(--border-mid)',
  },
  black: { background: '#131e32', transition: 'height 0.35s ease' },
  white: { background: '#e8edf5', transition: 'height 0.35s ease' },
};
