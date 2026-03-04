import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gamesApi } from '../../services/api';
import GameList from '../game/GameList';
import GameUpload from '../game/GameUpload';
import { useAuthStore } from '../../store/authStore';
import { PlusCircle, BarChart2 } from 'lucide-react';

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const [showUpload, setShowUpload] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['games'],
    queryFn: () => gamesApi.list().then((r) => r.data),
  });

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            <BarChart2 size={24} style={{ marginRight: 10, color: '#3b82f6' }} />
            My Games
          </h1>
          <p style={styles.subtitle}>
            Welcome back, <strong style={{ color: 'var(--text-1)' }}>{user?.email}</strong>
          </p>
        </div>
        <button
          style={styles.uploadBtn}
          onClick={() => setShowUpload((s) => !s)}
        >
          <PlusCircle size={18} />
          {showUpload ? 'Cancel' : 'Upload Game'}
        </button>
      </div>

      {showUpload && (
        <GameUpload
          onSuccess={() => {
            setShowUpload(false);
            refetch();
          }}
        />
      )}

      {isLoading ? (
        <div style={styles.loading}>Loading games…</div>
      ) : (
        <GameList
          games={data?.games ?? []}
          total={data?.total ?? 0}
          onRefresh={refetch}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '32px 20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text-1)',
    display: 'flex',
    alignItems: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: 'var(--text-4)',
    fontSize: 14,
  },
  uploadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 18px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  loading: {
    textAlign: 'center',
    color: 'var(--text-4)',
    padding: 60,
  },
};
