import { useState, useEffect, useCallback } from 'react';
import { Trophy, Plus, X, ChevronRight, Play } from 'lucide-react';
import { tournamentsApi, teamsApi, getErrorMessage } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import type {
  Tournament, TournamentFormat, TournamentTeamEntry,
  TournamentRound, TournamentMatch, Team,
} from '../../types';
import toast from 'react-hot-toast';

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  swiss: 'Swiss',
  round_robin: 'Round Robin',
  knockout: 'Knockout',
};

const STATUS_COLORS: Record<string, string> = {
  registration: '#60a5fa',
  active: '#22c55e',
  completed: '#94a3b8',
  cancelled: '#ef4444',
};

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateTournamentModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: Tournament) => void }) {
  const [form, setForm] = useState({
    name: '', description: '', format: 'swiss' as TournamentFormat,
    team_size: 4, time_control: 'rapid', max_teams: '', rounds_total: 5,
  });
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await tournamentsApi.create({
        ...form,
        max_teams: form.max_teams ? Number(form.max_teams) : undefined,
      });
      onCreated(data.tournament);
      toast.success('Tournament created!');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <h2 style={S.modalTitle}><Trophy size={18} style={{ marginRight: 8 }} />Create Tournament</h2>
          <button onClick={onClose} style={S.closeBtn}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={S.label}>Name *
            <input style={S.input} value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={100} />
          </label>
          <label style={S.label}>Description
            <textarea style={{ ...S.input, height: 72, resize: 'vertical' }} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={500} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={S.label}>Format
              <select style={S.input} value={form.format} onChange={(e) => set('format', e.target.value)}>
                <option value="swiss">Swiss</option>
                <option value="round_robin">Round Robin</option>
                <option value="knockout">Knockout</option>
              </select>
            </label>
            <label style={S.label}>Time Control
              <select style={S.input} value={form.time_control} onChange={(e) => set('time_control', e.target.value)}>
                <option value="bullet">Bullet</option>
                <option value="blitz">Blitz</option>
                <option value="rapid">Rapid</option>
              </select>
            </label>
            <label style={S.label}>Boards per match
              <input style={S.input} type="number" min={1} max={10} value={form.team_size} onChange={(e) => set('team_size', Number(e.target.value))} />
            </label>
            <label style={S.label}>Max Teams
              <input style={S.input} type="number" min={2} value={form.max_teams} onChange={(e) => set('max_teams', e.target.value)} placeholder="Unlimited" />
            </label>
            <label style={S.label}>Rounds
              <input style={S.input} type="number" min={1} max={20} value={form.rounds_total} onChange={(e) => set('rounds_total', Number(e.target.value))} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={S.btnGhost}>Cancel</button>
            <button type="submit" disabled={loading} style={S.btnPrimary}>{loading ? 'Creating…' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tournament Detail ─────────────────────────────────────────────────────────

function TournamentDetail({ tournament, standings, rounds: initialRounds, userId }: {
  tournament: Tournament;
  standings: TournamentTeamEntry[];
  rounds: TournamentRound[];
  userId: string;
}) {
  const [rounds, setRounds] = useState(initialRounds);
  const [selectedRound, setSelectedRound] = useState<string | null>(null);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [registering, setRegistering] = useState(false);
  const [starting, setStarting] = useState(false);
  const isOrganizer = tournament.organizer_id === userId;

  useEffect(() => {
    teamsApi.myTeams().then((r) => setMyTeams(r.data.teams)).catch(() => {});
  }, []);

  const loadRound = async (roundId: string) => {
    setSelectedRound(roundId);
    const { data } = await tournamentsApi.getRoundMatches(roundId);
    setMatches(data.matches);
  };

  const registerMyTeam = async (teamId: string) => {
    setRegistering(true);
    try {
      await tournamentsApi.registerTeam(tournament.id, teamId);
      toast.success('Team registered!');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setRegistering(false); }
  };

  const startTournament = async () => {
    setStarting(true);
    try {
      const { data } = await tournamentsApi.start(tournament.id);
      setRounds([data.round]);
      toast.success('Tournament started! Round 1 generated.');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setStarting(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={S.detailHeader}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h2 style={S.detailTitle}>{tournament.name}</h2>
            <span style={{ ...S.badge, background: (STATUS_COLORS[tournament.status] ?? '#94a3b8') + '22', color: STATUS_COLORS[tournament.status] ?? '#94a3b8' }}>
              {tournament.status}
            </span>
          </div>
          <p style={S.muted}>{FORMAT_LABELS[tournament.format]} • {tournament.time_control} • {tournament.team_size} boards/match • {tournament.rounds_done}/{tournament.rounds_total} rounds</p>
          {tournament.description && <p style={{ ...S.muted, marginTop: 6 }}>{tournament.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tournament.status === 'registration' && myTeams.length > 0 && (
            <select
              onChange={(e) => { if (e.target.value) registerMyTeam(e.target.value); e.target.value = ''; }}
              style={S.input} defaultValue="" disabled={registering}>
              <option value="" disabled>Register a team…</option>
              {myTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          {isOrganizer && tournament.status === 'registration' && (
            <button onClick={startTournament} disabled={starting} style={S.btnPrimary}>
              <Play size={14} style={{ marginRight: 4 }} />{starting ? 'Starting…' : 'Start Tournament'}
            </button>
          )}
        </div>
      </div>

      {/* Standings */}
      <div>
        <h3 style={S.sectionTitle}>Standings</h3>
        {standings.length === 0 && <p style={S.muted}>No teams registered yet.</p>}
        <table style={S.table}>
          <thead>
            <tr>{['#', 'Team', 'Rating', 'Match Pts', 'Board Pts'].map((h) => (
              <th key={h} style={S.th}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {standings.map((e, i) => (
              <tr key={e.team_id} style={i % 2 === 0 ? {} : { background: 'var(--bg-3)' }}>
                <td style={S.td}>{i + 1}</td>
                <td style={S.td}>{e.team_name ?? e.team_id}</td>
                <td style={S.td}>{e.team_rating ?? '—'}</td>
                <td style={S.td}>{e.match_points}</td>
                <td style={S.td}>{e.board_points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rounds */}
      {rounds.length > 0 && (
        <div>
          <h3 style={S.sectionTitle}>Rounds</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {rounds.map((r) => (
              <button key={r.id} onClick={() => loadRound(r.id)}
                style={{ ...S.roundBtn, ...(selectedRound === r.id ? S.roundBtnActive : {}) }}>
                Round {r.round_number}
                <span style={{ ...S.badge, marginLeft: 6, background: (STATUS_COLORS[r.status] ?? '#94a3b8') + '22', color: STATUS_COLORS[r.status] ?? '#94a3b8' }}>{r.status}</span>
              </button>
            ))}
          </div>

          {matches.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {matches.map((m) => (
                <div key={m.id} style={S.matchRow}>
                  <span style={S.matchTeam}>{m.team_a_name ?? m.team_a_id}</span>
                  <span style={S.score}>
                    {m.team_a_points} — {m.team_b_points}
                  </span>
                  <span style={{ ...S.matchTeam, textAlign: 'right' }}>{m.team_b_name ?? m.team_b_id}</span>
                  <span style={{ ...S.badge, background: (STATUS_COLORS[m.status] ?? '#94a3b8') + '22', color: STATUS_COLORS[m.status] ?? '#94a3b8', marginLeft: 8 }}>{m.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TournamentPage() {
  const user = useAuthStore((s) => s.user)!;
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selected, setSelected] = useState<{
    tournament: Tournament;
    standings: TournamentTeamEntry[];
    rounds: TournamentRound[];
  } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await tournamentsApi.list({ limit: 30 });
      setTournaments(data.tournaments);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectTournament = async (id: string) => {
    const { data } = await tournamentsApi.get(id);
    setSelected({ tournament: data.tournament, standings: data.standings, rounds: data.rounds });
  };

  const filtered = filter === 'all' ? tournaments : tournaments.filter((t) => t.status === filter);

  if (loading) return <div style={S.loading}>Loading tournaments…</div>;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.headerLeft}><Trophy size={22} color="#f59e0b" /><h1 style={S.title}>Tournaments</h1></div>
        <button onClick={() => setShowCreate(true)} style={S.btnPrimary}><Plus size={14} style={{ marginRight: 4 }} />New Tournament</button>
      </div>

      <div style={S.tabs}>
        {['all', 'registration', 'active', 'completed'].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ ...S.tab, ...(filter === s ? S.tabActive : {}) }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div style={S.layout}>
        <div style={S.list}>
          {filtered.length === 0 && <p style={S.muted}>No tournaments found.</p>}
          {filtered.map((t) => (
            <div key={t.id} onClick={() => selectTournament(t.id)}
              style={{ ...S.card, ...(selected?.tournament.id === t.id ? S.cardActive : {}) }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={S.cardTitle}>{t.name}</p>
                <p style={S.muted}>{FORMAT_LABELS[t.format]} • {t.time_control}</p>
              </div>
              <span style={{ ...S.badge, background: (STATUS_COLORS[t.status] ?? '#94a3b8') + '22', color: STATUS_COLORS[t.status] ?? '#94a3b8' }}>{t.status}</span>
              <ChevronRight size={14} color="var(--text-4)" />
            </div>
          ))}
        </div>

        <div style={S.detail}>
          {!selected ? (
            <p style={S.muted}>Select a tournament to view details.</p>
          ) : (
            <TournamentDetail
              tournament={selected.tournament}
              standings={selected.standings}
              rounds={selected.rounds}
              userId={user.id}
            />
          )}
        </div>
      </div>

      {showCreate && (
        <CreateTournamentModal
          onClose={() => setShowCreate(false)}
          onCreated={(t) => {
            setTournaments((prev) => [t, ...prev]);
            setShowCreate(false);
            selectTournament(t.id);
          }}
        />
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page:         { maxWidth: 1100, margin: '0 auto', padding: '24px 16px' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerLeft:   { display: 'flex', alignItems: 'center', gap: 10 },
  title:        { margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-1)' },
  tabs:         { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border-1)', paddingBottom: 4 },
  tab:          { background: 'none', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 6, color: 'var(--text-3)', fontWeight: 500, fontSize: 14 },
  tabActive:    { background: 'var(--bg-3)', color: 'var(--text-1)' },
  layout:       { display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 },
  list:         { display: 'flex', flexDirection: 'column', gap: 6 },
  card:         { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-1)', background: 'var(--bg-2)', cursor: 'pointer' },
  cardActive:   { borderColor: '#f59e0b', background: 'var(--bg-3)' },
  cardTitle:    { margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  detail:       { background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border-1)', padding: 20, minHeight: 200 },
  detailHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 16 },
  detailTitle:  { margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-1)' },
  badge:        { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999 },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: 'var(--text-3)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  muted:        { margin: 0, fontSize: 12, color: 'var(--text-4)' },
  input:        { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-1)', background: 'var(--bg-3)', color: 'var(--text-1)', fontSize: 14, outline: 'none', boxSizing: 'border-box', display: 'block', marginTop: 4 },
  label:        { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-3)' },
  btnPrimary:   { display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnGhost:     { display: 'flex', alignItems: 'center', padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border-1)', background: 'transparent', color: 'var(--text-2)', fontWeight: 500, fontSize: 13, cursor: 'pointer' },
  loading:      { textAlign: 'center', padding: 60, color: 'var(--text-4)' },
  overlay:      { position: 'fixed', inset: 0, background: '#0009', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border-1)', padding: 24, width: 460, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle:   { margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-1)', display: 'flex', alignItems: 'center' },
  closeBtn:     { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2 },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:           { textAlign: 'left', padding: '6px 10px', color: 'var(--text-3)', fontWeight: 600, borderBottom: '1px solid var(--border-1)', fontSize: 12 },
  td:           { padding: '7px 10px', color: 'var(--text-2)', borderBottom: '1px solid var(--border-1)' },
  roundBtn:     { padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border-1)', background: 'var(--bg-3)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center' },
  roundBtnActive: { borderColor: '#60a5fa', color: '#60a5fa' },
  matchRow:     { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-1)', background: 'var(--bg-3)' },
  matchTeam:    { flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-1)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  score:        { fontSize: 15, fontWeight: 700, color: 'var(--text-1)', minWidth: 60, textAlign: 'center' },
};
