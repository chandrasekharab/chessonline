import { useState, useEffect } from 'react';
import { useLiveGameStore } from '../../store/liveGameStore';
import { useAuthStore } from '../../store/authStore';
import { connectSocket, getSocket } from '../../services/socket';
import { TimeControl, TIME_CONTROL_LABELS, GameStartEvent } from '../../types';
import LiveBoard from './LiveBoard';
import toast from 'react-hot-toast';

const TIME_CONTROLS: TimeControl[] = ['bullet', 'blitz', 'rapid'];

export default function MatchmakingLobby() {
  const token = useAuthStore((s) => s.token);
  const {
    gameId, isQueued, queueTimeControl, waitingForOpponent, inviteCode,
    setGame, setQueued, setPrivateGame, reset,
  } = useLiveGameStore();

  const [inviteInput, setInviteInput] = useState('');
  const [selectedTc, setSelectedTc] = useState<TimeControl>('rapid');
  const [socketReady, setSocketReady] = useState(false);

  // Connect socket on mount
  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);
    socket.on('connect', () => setSocketReady(true));
    socket.on('disconnect', () => setSocketReady(false));
    if (socket.connected) setSocketReady(true);

    // Handle game start
    socket.on('game_start', (e: GameStartEvent) => {
      setGame(e.game, e.color);
    });

    // Private game created confirmation
    socket.on('private_game_created', ({ gameId: gId, inviteCode: code }: { gameId: string; inviteCode: string }) => {
      setPrivateGame(gId, code);
    });

    socket.on('queued', () => {});

    socket.on('error', (e: { message: string }) => {
      toast.error(e.message);
    });

    return () => {
      socket.off('game_start');
      socket.off('private_game_created');
      socket.off('queued');
      socket.off('error');
    };
  }, [token, setGame, setPrivateGame]);

  const joinQueue = () => {
    if (!socketReady) { toast.error('Not connected to server'); return; }
    getSocket().emit('join_queue', { timeControl: selectedTc });
    setQueued(selectedTc);
  };

  const leaveQueue = () => {
    getSocket().emit('leave_queue', {});
    setQueued(null);
  };

  const createPrivate = () => {
    if (!socketReady) { toast.error('Not connected'); return; }
    getSocket().emit('create_private_game', { timeControl: selectedTc });
  };

  const joinPrivate = () => {
    const code = inviteInput.trim().toUpperCase();
    if (!code) { toast.error('Enter an invite code'); return; }
    if (!socketReady) { toast.error('Not connected'); return; }
    getSocket().emit('join_private_game', { inviteCode: code });
  };

  // If currently in a game, show the board
  if (gameId) {
    return <LiveBoard />;
  }

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '24px' }}>
      <h1 style={{ color: '#e2e8f0', fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
        Play Live Chess
      </h1>
      <p style={{ color: '#64748b', marginBottom: '32px' }}>
        Challenge a random opponent or invite a friend.{' '}
        <span style={{ color: socketReady ? '#22c55e' : '#ef4444', fontSize: '12px' }}>
          ● {socketReady ? 'Connected' : 'Disconnected'}
        </span>
      </p>

      {/* Time control selector */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ color: '#94a3b8', display: 'block', marginBottom: '8px', fontSize: '14px' }}>
          Time Control
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {TIME_CONTROLS.map((tc) => (
            <button
              key={tc}
              onClick={() => setSelectedTc(tc)}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: `2px solid ${selectedTc === tc ? '#3b82f6' : '#334155'}`,
                background: selectedTc === tc ? '#1e3a5f' : '#1e293b',
                color: selectedTc === tc ? '#60a5fa' : '#94a3b8',
                cursor: 'pointer',
                fontWeight: selectedTc === tc ? 700 : 400,
                fontSize: '13px',
              }}
            >
              {tc === 'bullet' ? '⚡' : tc === 'blitz' ? '🔥' : '⏱'} {TIME_CONTROL_LABELS[tc]}
            </button>
          ))}
        </div>
      </div>

      {/* Quick match */}
      <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', marginBottom: '16px', border: '1px solid #334155' }}>
        <h2 style={{ color: '#e2e8f0', fontSize: '18px', fontWeight: 600, margin: '0 0 12px' }}>
          Quick Match
        </h2>
        {isQueued ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.5s infinite' }} />
              <span style={{ color: '#94a3b8' }}>
                Searching for {TIME_CONTROL_LABELS[queueTimeControl!]} opponent…
              </span>
            </div>
            <button
              onClick={leaveQueue}
              style={{ padding: '8px 20px', borderRadius: '6px', background: '#334155', color: '#e2e8f0', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={joinQueue}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '15px',
            }}
          >
            Find Game
          </button>
        )}
      </div>

      {/* Private game */}
      <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', border: '1px solid #334155' }}>
        <h2 style={{ color: '#e2e8f0', fontSize: '18px', fontWeight: 600, margin: '0 0 12px' }}>
          Private Game
        </h2>

        {/* Create */}
        {waitingForOpponent && inviteCode ? (
          <div style={{ marginBottom: '16px', padding: '12px', background: '#0f172a', borderRadius: '8px' }}>
            <p style={{ color: '#94a3b8', marginBottom: '8px', fontSize: '14px' }}>Share this invite code:</p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '4px', color: '#60a5fa', fontFamily: 'monospace' }}>
                {inviteCode}
              </span>
              <button
                onClick={() => { navigator.clipboard.writeText(inviteCode); toast.success('Copied!'); }}
                style={{ padding: '6px 12px', borderRadius: '6px', background: '#334155', color: '#e2e8f0', border: 'none', cursor: 'pointer', fontSize: '13px' }}
              >
                Copy
              </button>
            </div>
            <p style={{ color: '#475569', fontSize: '13px', marginTop: '8px' }}>Waiting for opponent…</p>
            <button onClick={reset} style={{ marginTop: '8px', padding: '6px 12px', borderRadius: '6px', background: '#7f1d1d', color: '#fca5a5', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={createPrivate}
            style={{
              padding: '8px 20px',
              borderRadius: '6px',
              background: '#1d4ed8',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              marginBottom: '16px',
            }}
          >
            Create Room
          </button>
        )}

        {/* Join with code */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
            placeholder="Enter invite code"
            maxLength={8}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              background: '#0f172a',
              border: '1px solid #334155',
              color: '#e2e8f0',
              fontFamily: 'monospace',
              fontSize: '16px',
              letterSpacing: '2px',
            }}
          />
          <button
            onClick={joinPrivate}
            style={{ padding: '8px 16px', borderRadius: '6px', background: '#059669', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            Join
          </button>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
