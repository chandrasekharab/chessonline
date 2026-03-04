interface Props {
  current: number;
  total: number;
}

export default function AnalysisProgressBar({ current, total }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const totalMoves = total > 0 ? Math.ceil(total / 2) : '?';
  const currentMove = current > 0 ? Math.ceil(current / 2) : 0;
  // Which ply is being evaluated right now (1-indexed, capped)
  const analysing = current < total ? current + 1 : current;
  const moveNum = Math.ceil(analysing / 2);
  const side = analysing % 2 === 1 ? 'White' : 'Black';

  return (
    <div style={styles.container}>
      {/* Top row: label + percentage */}
      <div style={styles.topRow}>
        <div style={styles.leftLabel}>
          <span style={styles.pulsingDot} />
          {current === 0 ? (
            <span style={styles.text}>Preparing analysis…</span>
          ) : current >= total ? (
            <span style={styles.text}>Finalising…</span>
          ) : (
            <span style={styles.text}>
              Analysing move <strong style={styles.hl}>{moveNum}</strong>{' '}
              <span style={styles.side}>({side} to move)</span>
            </span>
          )}
        </div>
        <span style={styles.pct}>{pct}%</span>
      </div>

      {/* Progress track */}
      <div style={styles.track}>
        <div
          style={{
            ...styles.fill,
            width: `${pct}%`,
            // Pulse the fill while not complete
            animation: pct < 100 ? 'progressShimmer 2s linear infinite' : 'none',
          }}
        />
      </div>

      {/* Bottom row: move counts */}
      <div style={styles.bottomRow}>
        <span style={styles.subtext}>
          {currentMove} of {totalMoves} moves evaluated
        </span>
        <span style={styles.subtext}>{total > 0 ? total : '…'} plies total</span>
      </div>

      {/* Keyframes injected once via a style tag */}
      <style>{`
        @keyframes progressShimmer {
          0%   { filter: brightness(1); }
          50%  { filter: brightness(1.25); }
          100% { filter: brightness(1); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-app) 100%)',
    border: '1px solid #f59e0b44',
    borderRadius: 10,
    padding: '14px 18px',
    marginBottom: 20,
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  leftLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#f59e0b',
    flexShrink: 0,
    animation: 'pulseDot 1.4s ease-in-out infinite',
  } as React.CSSProperties,
  text: {
    color: '#fcd34d',
    fontSize: 14,
  },
  hl: {
    color: '#fff',
    fontWeight: 700,
  },
  side: {
    color: 'var(--text-3)',
    fontWeight: 400,
  },
  pct: {
    color: '#fbbf24',
    fontWeight: 700,
    fontSize: 15,
    minWidth: 42,
    textAlign: 'right',
  },
  track: {
    width: '100%',
    height: 8,
    background: 'var(--bg-elevated)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 60%, #fde68a 100%)',
    borderRadius: 999,
    transition: 'width 0.8s ease',
  },
  bottomRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  subtext: {
    color: 'var(--text-5)',
    fontSize: 12,
  },
};
