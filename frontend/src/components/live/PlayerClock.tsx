interface PlayerClockProps {
  timeMs: number;
  isActive: boolean;
  label: string;
  rating?: number;
}

function formatTime(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function PlayerClock({ timeMs, isActive, label, rating }: PlayerClockProps) {
  const isLow = timeMs > 0 && timeMs < 10_000;
  const isEmpty = timeMs <= 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        borderRadius: '8px',
        background: isActive ? '#1e3a5f' : 'var(--bg-surface)',
        border: `2px solid ${isActive ? '#3b82f6' : 'var(--border-strong)'}`,
        transition: 'all 0.3s ease',
        minWidth: '200px',
      }}
    >
      <div>
        <div style={{ color: 'var(--text-3)', fontSize: '12px', marginBottom: '2px' }}>{label}</div>
        {rating !== undefined && (
          <div style={{ color: 'var(--text-4)', fontSize: '11px' }}>
            {rating} ELO
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: '28px',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'monospace',
          color: isEmpty ? '#ef4444' : isLow ? '#f97316' : isActive ? '#60a5fa' : 'var(--text-2)',
          animation: isLow && isActive ? 'pulse 1s infinite' : undefined,
        }}
      >
        {formatTime(timeMs)}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}
