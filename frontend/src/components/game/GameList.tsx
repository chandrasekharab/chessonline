import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { BarChart2, Trash2, PlayCircle, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';
import type { Game, GameStatus } from '../../types';
import { gamesApi, getErrorMessage } from '../../services/api';

interface Props {
  games: Game[];
  total: number;
  onRefresh: () => void;
}

const STATUS_ICONS: Record<GameStatus, JSX.Element> = {
  uploaded: <Clock size={14} color="#64748b" />,
  analyzing: <Loader size={14} color="#f59e0b" />,
  completed: <CheckCircle size={14} color="#22c55e" />,
  failed: <XCircle size={14} color="#ef4444" />,
};

const STATUS_COLOR: Record<GameStatus, string> = {
  uploaded: '#64748b',
  analyzing: '#f59e0b',
  completed: '#22c55e',
  failed: '#ef4444',
};

export default function GameList({ games, total, onRefresh }: Props) {
  const navigate = useNavigate();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => gamesApi.delete(id),
    onSuccess: () => {
      toast.success('Game deleted');
      onRefresh();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const analyseMutation = useMutation({
    mutationFn: (id: string) => gamesApi.analyze(id),
    onSuccess: () => {
      toast.success('Analysis started!');
      onRefresh();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (games.length === 0) {
    return (
      <div style={styles.empty}>
        <span style={{ fontSize: 48 }}>♟</span>
        <p>No games yet. Upload your first PGN to get started.</p>
      </div>
    );
  }

  return (
    <div>
      <p style={styles.count}>{total} game{total !== 1 ? 's' : ''}</p>
      <div style={styles.list}>
        {games.map((game) => {
          const meta = game.metadata_json;
          const white = meta.white ?? 'White';
          const black = meta.black ?? 'Black';
          const date = meta.date ?? '—';
          const result = meta.result ?? '?';
          const event = meta.event ?? 'Casual Game';

          return (
            <div key={game.id} style={styles.card}>
              <div
                style={styles.cardContent}
                onClick={() => navigate(`/games/${game.id}`)}
                role="button"
              >
                <div style={styles.players}>
                  <span style={styles.playerName}>{white}</span>
                  <span style={styles.vs}>vs</span>
                  <span style={styles.playerName}>{black}</span>
                  <span style={styles.result}>{result}</span>
                </div>
                <div style={styles.meta}>
                  <span>{event}</span>
                  <span>·</span>
                  <span>{date}</span>
                  <span>·</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: STATUS_COLOR[game.status],
                    }}
                  >
                    {STATUS_ICONS[game.status]}
                    {game.status}
                  </span>
                </div>
              </div>
              <div style={styles.actions}>
                {game.status === 'completed' && (
                  <button
                    style={styles.iconBtn}
                    onClick={() => navigate(`/games/${game.id}`)}
                    title="View analysis"
                  >
                    <BarChart2 size={16} />
                  </button>
                )}
                {(game.status === 'uploaded' || game.status === 'failed') && (
                  <button
                    style={{ ...styles.iconBtn, color: '#3b82f6' }}
                    onClick={() => analyseMutation.mutate(game.id)}
                    disabled={analyseMutation.isPending}
                    title="Analyse game"
                  >
                    <PlayCircle size={16} />
                  </button>
                )}
                {game.status === 'completed' && (
                  <button
                    style={{ ...styles.iconBtn, color: '#f59e0b' }}
                    onClick={() => analyseMutation.mutate(game.id)}
                    disabled={analyseMutation.isPending}
                    title="Re-analyse"
                  >
                    <PlayCircle size={16} />
                  </button>
                )}
                <button
                  style={{ ...styles.iconBtn, color: '#ef4444' }}
                  onClick={() => {
                    if (window.confirm('Delete this game?')) deleteMutation.mutate(game.id);
                  }}
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  count: { color: '#64748b', fontSize: 13, marginBottom: 12 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: {
    display: 'flex',
    alignItems: 'center',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '14px 16px',
    transition: 'border-color 0.2s',
    gap: 12,
  },
  cardContent: {
    flex: 1,
    cursor: 'pointer',
    minWidth: 0,
  },
  players: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  playerName: { fontWeight: 600, color: '#f1f5f9', fontSize: 15 },
  vs: { color: '#475569', fontSize: 12 },
  result: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 4,
    padding: '1px 6px',
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: 600,
    fontFamily: 'monospace',
  },
  meta: { display: 'flex', gap: 8, color: '#475569', fontSize: 13, alignItems: 'center' },
  actions: { display: 'flex', gap: 8 },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    transition: 'color 0.2s',
  },
  empty: {
    textAlign: 'center',
    padding: '80px 20px',
    color: '#475569',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
};
