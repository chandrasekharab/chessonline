/**
 * ExplanationPanel
 *
 * Renders an "Explain Move" button and, once triggered, displays:
 *   • The AI-generated coaching explanation
 *   • Structured position signals (evaluation drop, king safety, etc.)
 *   • Rating tier indicator
 *   • Cached/live badge
 *
 * Only renders the button for moves labelled mistake / blunder / missed_win.
 * Regular good/excellent moves show a lightweight badge instead.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { explanationApi, getErrorMessage } from '../../services/api';
import type { AnalysisMove } from '../../types';
import type { ExplainMoveResponse, PositionFeatures } from '../../types';
import { MessageSquare, Zap, Loader2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface Props {
  gameId: string;
  move: AnalysisMove;
}

const EXPLAINABLE_LABELS = new Set(['mistake', 'blunder', 'missed_win', 'inaccuracy']);
const GOOD_LABELS = new Set(['best', 'excellent', 'good', 'book']);

const TIER_BADGE_COLORS: Record<string, string> = {
  beginner: '#86efac',
  intermediate: '#fbbf24',
  advanced: '#a78bfa',
};

const KING_SAFETY_ICONS: Record<string, string> = {
  safe: '🟢',
  slightly_exposed: '🟡',
  exposed: '🟠',
  critical: '🔴',
};

function FeatureRow({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <div style={styles.featureRow}>
      <span style={styles.featureLabel}>{icon ? `${icon} ` : ''}{label}</span>
      <span style={styles.featureValue}>{value}</span>
    </div>
  );
}

function FeaturesExpanded({ features }: { features: PositionFeatures }) {
  const evalDrop = (features.evaluation_drop / 100).toFixed(2);
  const evalBefore = (features.evaluation_before / 100).toFixed(2);
  const evalAfter = (features.evaluation_after / 100).toFixed(2);
  const material = features.material_balance >= 0
    ? `+${features.material_balance}`
    : `${features.material_balance}`;

  return (
    <div style={styles.featuresBox}>
      <div style={styles.featuresTitle}>Position Signals</div>
      <FeatureRow label="Eval before / after" value={`${evalBefore} → ${evalAfter} (−${evalDrop})`} icon="📉" />
      <FeatureRow label="Material (white)" value={`${material} pawns`} icon="⚖️" />
      <FeatureRow
        label="King safety"
        value={features.king_safety_status.replace(/_/g, ' ')}
        icon={KING_SAFETY_ICONS[features.king_safety_status]}
      />
      <FeatureRow
        label="Center control"
        value={features.center_control_status.replace(/_/g, ' ')}
        icon="🎯"
      />
      {features.hanging_pieces && (
        <FeatureRow label="Hanging pieces" value="Yes — undefended pieces present" icon="⚠️" />
      )}
      {features.tactical_threat_allowed && (
        <FeatureRow label="Threat allowed" value={features.tactical_threat_allowed} icon="⚔️" />
      )}
      <FeatureRow label="Better move" value={features.better_alternative || '—'} icon="✅" />
      {features.principal_variation.length > 0 && (
        <FeatureRow
          label="Principal variation"
          value={features.principal_variation.join(' ')}
          icon="↪️"
        />
      )}
    </div>
  );
}

export default function ExplanationPanel({ gameId, move }: Props) {
  const [result, setResult] = useState<ExplainMoveResponse | null>(null);
  const [showFeatures, setShowFeatures] = useState(false);

  const isExplainable = EXPLAINABLE_LABELS.has(move.label);

  const mutation = useMutation({
    mutationFn: () =>
      explanationApi.explainMove(gameId, move.move_number).then((r) => r.data),
    onSuccess: (data) => setResult(data),
  });

  if (!isExplainable) {
    if (GOOD_LABELS.has(move.label)) {
      return (
        <div style={{ padding: '10px 14px', background: '#0f2d1f', border: '1px solid #166534', borderRadius: 8, color: '#4ade80', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>✓</span>
          <span>This was a <strong>{move.label}</strong> move. No explanation needed — well played!</span>
        </div>
      );
    }
    return null;
  }

  return (
    <div style={styles.container}>
      {!result && !mutation.isPending && (
        <button
          onClick={() => mutation.mutate()}
          style={styles.explainBtn}
          title="Ask AI to explain this move"
        >
          <MessageSquare size={16} />
          ✦ Explain Move with AI
        </button>
      )}

      {mutation.isPending && (
        <div style={styles.loadingRow}>
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          <span style={styles.loadingText}>Generating explanation…</span>
        </div>
      )}

      {mutation.isError && (
        <div style={styles.errorRow}>
          <AlertTriangle size={13} />
          <span style={{ color: '#fca5a5', fontSize: 12 }}>
            {getErrorMessage(mutation.error)}
          </span>
        </div>
      )}

      {result && (
        <div style={styles.panel}>
          {/* Header */}
          <div style={styles.panelHeader}>
            <div style={styles.panelHeaderLeft}>
              <Zap size={14} color="#fbbf24" />
              <span style={styles.panelTitle}>AI Coaching</span>
            </div>
            <div style={styles.badges}>
              <span style={{
                ...styles.badge,
                background: TIER_BADGE_COLORS[result.rating_tier] + '22',
                color: TIER_BADGE_COLORS[result.rating_tier],
                borderColor: TIER_BADGE_COLORS[result.rating_tier] + '55',
              }}>
                {result.rating_tier}
              </span>
              {result.cached && (
                <span style={styles.cachedBadge}>cached</span>
              )}
            </div>
          </div>

          {/* Explanation text */}
          <p style={styles.explanationText}>{result.explanation}</p>

          {/* Toggle features */}
          <button
            style={styles.featuresToggle}
            onClick={() => setShowFeatures((v) => !v)}
          >
            {showFeatures ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showFeatures ? 'Hide' : 'Show'} position signals
          </button>

          {showFeatures && <FeaturesExpanded features={result.features} />}

          {/* Re-ask button */}
          <button
            style={styles.reaskBtn}
            onClick={() => { setResult(null); mutation.reset(); }}
          >
            Re-explain
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: 8,
  },
  explainBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    justifyContent: 'center',
    letterSpacing: '0.02em',
    boxShadow: '0 2px 8px rgba(79,70,229,0.4)',
  },
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--text-3)',
    fontSize: 12,
    padding: '4px 0',
  },
  loadingText: {
    color: 'var(--text-3)',
    fontSize: 12,
  },
  errorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#fca5a5',
    fontSize: 12,
    padding: '4px 0',
  },
  panel: {
    background: 'var(--bg-app)',
    border: '1px solid #1e3a5f',
    borderRadius: 8,
    padding: '12px 14px',
    marginTop: 4,
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  panelHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  panelTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-2)',
  },
  badges: {
    display: 'flex',
    gap: 5,
  },
  badge: {
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  cachedBadge: {
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 6px',
    borderRadius: 4,
    border: '1px solid var(--border-strong)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-4)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  explanationText: {
    fontSize: 13,
    color: 'var(--text-2)',
    lineHeight: 1.65,
    whiteSpace: 'pre-line' as const,
    margin: '0 0 10px',
  },
  featuresToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'transparent',
    border: 'none',
    color: 'var(--text-5)',
    fontSize: 11,
    cursor: 'pointer',
    padding: '2px 0',
    marginBottom: 4,
  },
  featuresBox: {
    background: 'var(--bg-surface)',
    border: '1px solid #1e3a5f',
    borderRadius: 6,
    padding: '10px 12px',
    marginTop: 6,
    marginBottom: 8,
  },
  featuresTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-5)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: 6,
  },
  featureRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    padding: '2px 0',
    fontSize: 12,
    borderBottom: '1px solid var(--bg-app)',
  },
  featureLabel: {
    color: 'var(--text-4)',
    flexShrink: 0,
  },
  featureValue: {
    color: 'var(--text-3)',
    textAlign: 'right' as const,
    fontSize: 11,
    wordBreak: 'break-word' as const,
  },
  reaskBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-5)',
    fontSize: 11,
    cursor: 'pointer',
    padding: '2px 0',
    marginTop: 2,
  },
};
