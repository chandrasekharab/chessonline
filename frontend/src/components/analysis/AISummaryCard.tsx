/**
 * AISummaryCard
 *
 * Post-game AI summary panel showing:
 *   • Top 3 recurring weaknesses
 *   • Training suggestion
 *   • Tactical vs positional error breakdown
 *   • Full AI-generated coaching text
 *
 * Lazily fetches or triggers generation on first render.
 * Shows loading skeleton while waiting.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { explanationApi } from '../../services/api';
import { Brain, TrendingDown, Target, BookOpen, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface Props {
  gameId: string;
  /** Whether analysis has completed — summary only available after this */
  analysisComplete: boolean;
}

function ErrorRatio({
  tactical,
  positional,
}: {
  tactical: number;
  positional: number;
}) {
  const total = tactical + positional || 1;
  const tacticalPct = Math.round((tactical / total) * 100);
  const positionalPct = 100 - tacticalPct;

  return (
    <div style={styles.ratioContainer}>
      <div style={styles.ratioLabel}>
        <span style={{ color: '#f97316' }}>⚔️ Tactical</span>
        <span style={{ color: '#f97316', fontWeight: 700 }}>{tactical} ({tacticalPct}%)</span>
      </div>
      <div style={styles.ratioBar}>
        <div
          style={{
            width: `${tacticalPct}%`,
            height: '100%',
            background: '#f97316',
            borderRadius: '4px 0 0 4px',
            transition: 'width 0.6s ease',
          }}
        />
        <div
          style={{
            width: `${positionalPct}%`,
            height: '100%',
            background: '#6366f1',
            borderRadius: '0 4px 4px 0',
          }}
        />
      </div>
      <div style={styles.ratioLabel}>
        <span style={{ color: '#6366f1' }}>♟️ Positional</span>
        <span style={{ color: '#6366f1', fontWeight: 700 }}>{positional} ({positionalPct}%)</span>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={styles.skeleton}>
      {[120, 90, 150, 80].map((w, i) => (
        <div
          key={i}
          style={{ ...styles.skeletonLine, width: w, animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  );
}

export default function AISummaryCard({ gameId, analysisComplete }: Props) {
  const [expanded, setExpanded] = useState(false);

  const {
    data: summary,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['ai-summary', gameId],
    queryFn: () => explanationApi.getGameSummary(gameId).then((r) => r.data),
    enabled: analysisComplete,
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 min
  });

  if (!analysisComplete) {
    return (
      <div style={styles.card}>
        <div style={styles.header}>
          <Brain size={16} color="#a78bfa" />
          <span style={styles.title}>AI Game Summary</span>
        </div>
        <p style={styles.hint}>Available after analysis completes.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={styles.card}>
        <div style={styles.header}>
          <Brain size={16} color="#a78bfa" />
          <span style={styles.title}>AI Game Summary</span>
          <RefreshCw size={12} color="#475569" style={{ marginLeft: 4, animation: 'spin 1.2s linear infinite' }} />
        </div>
        <Skeleton />
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div style={styles.card}>
        <div style={styles.header}>
          <Brain size={16} color="#a78bfa" />
          <span style={styles.title}>AI Game Summary</span>
        </div>
        <p style={styles.hint}>
          Could not load summary.{' '}
          <button style={styles.retryBtn} onClick={() => refetch()}>Retry</button>
        </p>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.header}>
        <Brain size={16} color="#a78bfa" />
        <span style={styles.title}>AI Game Summary</span>
        <div style={styles.headerRight}>
          {summary.cached && <span style={styles.cachedBadge}>cached</span>}
          <span style={styles.modelBadge}>{summary.model_used}</span>
        </div>
      </div>

      {/* Error ratio bar */}
      <ErrorRatio
        tactical={summary.tactical_error_count}
        positional={summary.positional_error_count}
      />

      {/* Top weaknesses */}
      {summary.top_weaknesses.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <TrendingDown size={13} color="#f97316" /> Top Weaknesses
          </div>
          <ol style={styles.weaknessList}>
            {summary.top_weaknesses.map((w, i) => (
              <li key={i} style={styles.weaknessItem}>{w}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Training focus */}
      {summary.training_focus && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <Target size={13} color="#22c55e" /> Training Focus
          </div>
          <p style={styles.trainingText}>{summary.training_focus}</p>
        </div>
      )}

      {/* Full AI text toggle */}
      <button
        style={styles.toggleBtn}
        onClick={() => setExpanded((v) => !v)}
      >
        <BookOpen size={12} />
        {expanded ? 'Hide' : 'Show'} full coach notes
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div style={styles.fullText}>
          {summary.summary_text}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--bg-app)',
    border: '1px solid #2d1b69',
    borderRadius: 10,
    padding: '14px 16px',
    marginBottom: 16,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text-2)',
    flex: 1,
  },
  headerRight: {
    display: 'flex',
    gap: 5,
    alignItems: 'center',
  },
  cachedBadge: {
    fontSize: 10,
    padding: '1px 5px',
    borderRadius: 4,
    border: '1px solid var(--border-strong)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-4)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  modelBadge: {
    fontSize: 10,
    padding: '1px 5px',
    borderRadius: 4,
    border: '1px solid #2d1b69',
    background: '#1e1444',
    color: '#a78bfa',
    letterSpacing: '0.02em',
  },
  ratioContainer: {
    marginBottom: 14,
  },
  ratioBar: {
    display: 'flex',
    height: 6,
    borderRadius: 4,
    overflow: 'hidden',
    background: 'var(--bg-elevated)',
    margin: '4px 0',
  },
  ratioLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
    color: 'var(--text-4)',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 5,
  },
  weaknessList: {
    margin: 0,
    padding: '0 0 0 18px',
    color: 'var(--text-2)',
    fontSize: 13,
    lineHeight: 1.7,
  },
  weaknessItem: {
    marginBottom: 2,
  },
  trainingText: {
    fontSize: 13,
    color: '#86efac',
    lineHeight: 1.55,
    margin: 0,
    background: '#0a2817',
    border: '1px solid #14532d',
    borderRadius: 6,
    padding: '8px 10px',
  },
  toggleBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    background: 'transparent',
    border: 'none',
    color: 'var(--text-5)',
    fontSize: 11,
    cursor: 'pointer',
    padding: '4px 0',
    marginTop: 2,
  },
  fullText: {
    marginTop: 8,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-mid)',
    borderRadius: 6,
    padding: '12px',
    fontSize: 13,
    color: 'var(--text-3)',
    lineHeight: 1.65,
    whiteSpace: 'pre-line' as const,
  },
  hint: {
    color: 'var(--text-5)',
    fontSize: 13,
    margin: 0,
  },
  retryBtn: {
    background: 'transparent',
    border: 'none',
    color: '#3b82f6',
    cursor: 'pointer',
    fontSize: 13,
    padding: 0,
    textDecoration: 'underline',
  },
  skeleton: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 4,
    background: 'linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-surface) 50%, var(--bg-elevated) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
  },
};
