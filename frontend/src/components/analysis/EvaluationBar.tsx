interface Props {
  evalCp: number;
}

/**
 * Vertical evaluation bar: white at top (good for white = tall white section).
 * Clamps to ±1500 cp for display.
 */
export default function EvaluationBar({ evalCp }: Props) {
  const clamped = Math.max(-1500, Math.min(1500, evalCp));
  // Convert to 0-100 percentage for white (50 = equal)
  const whitePercent = 50 + (clamped / 1500) * 50;

  const label =
    evalCp >= 0
      ? evalCp >= 30000
        ? 'M'
        : `+${(evalCp / 100).toFixed(1)}`
      : evalCp <= -30000
        ? '-M'
        : (evalCp / 100).toFixed(1);

  return (
    <div style={styles.container}>
      <span style={{ ...styles.label, color: clamped <= 0 ? '#f8fafc' : '#1a1a2e' }}>
        {label}
      </span>
      <div style={styles.bar}>
        {/* Black section (top) */}
        <div
          style={{
            ...styles.black,
            height: `${100 - whitePercent}%`,
          }}
        />
        {/* White section (bottom) */}
        <div
          style={{
            ...styles.white,
            height: `${whitePercent}%`,
          }}
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: 28,
    height: 400,
    flexShrink: 0,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  bar: {
    flex: 1,
    width: '100%',
    borderRadius: 4,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid #334155',
  },
  black: {
    background: '#1a1a2e',
    transition: 'height 0.4s ease',
  },
  white: {
    background: '#f8fafc',
    transition: 'height 0.4s ease',
  },
};
