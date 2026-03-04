/**
 * AIPuzzleExplainer
 *
 * Shows an "Explain this puzzle" button after a puzzle is solved or the
 * solution is revealed. Calls POST /explanations/puzzle/explain and displays
 * the LLM coaching explanation.
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { explanationApi, getErrorMessage } from '../../services/api';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';

interface Props {
  fen: string;             // starting FEN of the puzzle
  solution: string[];      // UCI moves of the full solution
  tags: string[];          // tactical theme tags
  rating?: number;         // player rating for personalisation
}

export default function AIPuzzleExplainer({ fen, solution, tags, rating }: Props) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [model, setModel] = useState<string>('');

  const mutation = useMutation({
    mutationFn: () =>
      explanationApi.explainPuzzle(fen, solution, tags, rating).then((r) => r.data),
    onSuccess: (data) => {
      setExplanation(data.explanation);
      setModel(data.model_used);
    },
  });

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <Sparkles size={14} style={{ color: '#818cf8' }} />
        <span style={styles.headerText}>AI Coach</span>
        {model && !mutation.isPending && (
          <span style={styles.modelBadge}>{model}</span>
        )}
      </div>

      {!explanation && !mutation.isPending && (
        <div style={styles.promptRow}>
          <p style={styles.promptText}>
            Get an AI explanation of why this solution works and what tactical pattern to remember.
          </p>
          <button style={styles.explainBtn} onClick={() => mutation.mutate()}>
            <Sparkles size={14} /> Explain this Puzzle
          </button>
          {mutation.isError && (
            <p style={styles.errorText}>{getErrorMessage(mutation.error)}</p>
          )}
        </div>
      )}

      {mutation.isPending && (
        <div style={styles.loading}>
          <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
          <span>AI is analysing the puzzle…</span>
        </div>
      )}

      {explanation && (
        <div style={styles.resultBox}>
          <p style={styles.explanationText}>{explanation}</p>
          <button
            style={styles.reaskBtn}
            onClick={() => { setExplanation(null); mutation.mutate(); }}
          >
            <RefreshCw size={12} /> Ask again
          </button>
        </div>
      )}

      {/* Spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: 'var(--bg-app)',
    border: '1px solid #312e81',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 16,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'linear-gradient(90deg, #1e1b4b 0%, var(--bg-elevated) 100%)',
    borderBottom: '1px solid #312e81',
    padding: '8px 14px',
  },
  headerText: {
    fontSize: 12,
    fontWeight: 700,
    color: '#c7d2fe',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  modelBadge: {
    marginLeft: 'auto',
    fontSize: 10,
    color: '#4f46e5',
    background: '#1e1b4b',
    border: '1px solid #3730a3',
    borderRadius: 4,
    padding: '1px 6px',
  },
  promptRow: {
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    alignItems: 'flex-start',
  },
  promptText: {
    margin: 0,
    fontSize: 13,
    color: 'var(--text-4)',
    lineHeight: 1.5,
  },
  explainBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '9px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  errorText: {
    margin: 0,
    fontSize: 12,
    color: '#ef4444',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '16px',
    color: '#818cf8',
    fontSize: 13,
  },
  resultBox: {
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  },
  explanationText: {
    margin: 0,
    fontSize: 14,
    color: 'var(--text-2)',
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap' as const,
  },
  reaskBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    background: 'transparent',
    border: '1px solid var(--border-strong)',
    color: 'var(--text-5)',
    borderRadius: 6,
    padding: '5px 10px',
    fontSize: 11,
    cursor: 'pointer',
    alignSelf: 'flex-end' as const,
  },
};
