import { useState, useEffect, useCallback } from 'react';
import { Award, Plus, X, Users, Megaphone, ChevronRight, Check } from 'lucide-react';
import { leaguesApi, teamsApi, getErrorMessage } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import type { League, LeagueTeamEntry, LeagueAnnouncement, Team } from '../../types';
import toast from 'react-hot-toast';

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateLeagueModal({ onClose, onCreated }: { onClose: () => void; onCreated: (l: League) => void }) {
  const [form, setForm] = useState({ name: '', description: '', visibility: 'public' as 'public' | 'private', season: '', start_date: '', end_date: '' });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await leaguesApi.create({ ...form, season: form.season ? Number(form.season) : undefined });
      onCreated(data.league);
      toast.success('League created!');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <h2 style={S.modalTitle}><Award size={18} style={{ marginRight: 8 }} />Create League</h2>
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
            <label style={S.label}>Visibility
              <select style={S.input} value={form.visibility} onChange={(e) => set('visibility', e.target.value as 'public' | 'private')}>
                <option value="public">Public</option>
                <option value="private">Private (invite code)</option>
              </select>
            </label>
            <label style={S.label}>Season
              <input style={S.input} value={form.season} onChange={(e) => set('season', e.target.value)} placeholder="e.g. 2025-spring" />
            </label>
            <label style={S.label}>Start Date
              <input style={S.input} type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
            </label>
            <label style={S.label}>End Date
              <input style={S.input} type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
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

// ── Join by Code Modal ────────────────────────────────────────────────────────

function JoinByCodeModal({ onClose, onJoined }: { onClose: () => void; onJoined: () => void }) {
  const [code, setCode] = useState('');
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { teamsApi.myTeams().then((r) => setMyTeams(r.data.teams)).catch(() => {}); }, []);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) { toast.error('Select a team first'); return; }
    setLoading(true);
    try {
      await leaguesApi.joinByCode(code, teamId);
      toast.success('Joined league!');
      onJoined();
      onClose();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  };

  return (
    <div style={S.overlay}>
      <div style={{ ...S.modal, width: 360 }}>
        <div style={S.modalHeader}>
          <h2 style={S.modalTitle}>Join by Invite Code</h2>
          <button onClick={onClose} style={S.closeBtn}><X size={18} /></button>
        </div>
        <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={S.label}>Invite Code *
            <input style={S.input} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required maxLength={20} placeholder="XXXXXX" />
          </label>
          <label style={S.label}>Your Team *
            <select style={S.input} value={teamId} onChange={(e) => setTeamId(e.target.value)} required>
              <option value="">Select team…</option>
              {myTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={S.btnGhost}>Cancel</button>
            <button type="submit" disabled={loading} style={S.btnPrimary}>{loading ? 'Joining…' : 'Join'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── League Detail ─────────────────────────────────────────────────────────────

function LeagueDetail({ league, teams: initialTeams, announcements: initialAnnouncements, userId, onRefresh }: {
  league: League;
  teams: LeagueTeamEntry[];
  announcements: LeagueAnnouncement[];
  userId: string;
  onRefresh: () => void;
}) {
  const [teams, setTeams] = useState(initialTeams);
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [announcement, setAnnouncement] = useState('');
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [joining, setJoining] = useState(false);
  const [posting, setPosting] = useState(false);
  const isOrganizer = league.organizer_id === userId;
  const approved = teams.filter((t) => t.approved);
  const pending  = teams.filter((t) => !t.approved);

  useEffect(() => {
    setTeams(initialTeams);
    setAnnouncements(initialAnnouncements);
  }, [initialTeams, initialAnnouncements]);

  useEffect(() => { teamsApi.myTeams().then((r) => setMyTeams(r.data.teams)).catch(() => {}); }, []);

  const joinWithTeam = async (teamId: string) => {
    setJoining(true);
    try {
      await leaguesApi.joinById(league.id, teamId);
      toast.success(league.visibility === 'public' ? 'Joined league!' : 'Request sent — awaiting approval');
      onRefresh();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setJoining(false); }
  };

  const approve = async (teamId: string) => {
    try {
      await leaguesApi.approveTeam(league.id, teamId);
      setTeams((prev) => prev.map((t) => t.team_id === teamId ? { ...t, status: 'approved' } : t));
      toast.success('Team approved!');
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const remove = async (teamId: string) => {
    try {
      await leaguesApi.removeTeam(league.id, teamId);
      setTeams((prev) => prev.filter((t) => t.team_id !== teamId));
      toast.success('Team removed.');
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const postAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcement.trim()) return;
    setPosting(true);
    try {
      const { data } = await leaguesApi.postAnnouncement(league.id, announcement.trim());
      setAnnouncements((prev) => [data.announcement, ...prev]);
      setAnnouncement('');
      toast.success('Announcement posted!');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setPosting(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h2 style={S.detailTitle}>{league.name}</h2>
          <span style={{ ...S.badge, background: league.visibility === 'private' ? '#f59e0b22' : '#22c55e22', color: league.visibility === 'private' ? '#f59e0b' : '#22c55e' }}>
            {league.visibility}
          </span>
        </div>
        {league.description && <p style={S.muted}>{league.description}</p>}
        {league.season && <p style={S.muted}>Season: {league.season}</p>}
        {league.invite_code && isOrganizer && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '6px 12px', background: 'var(--bg-3)', borderRadius: 6, border: '1px solid var(--border-1)', width: 'fit-content' }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Invite Code:</span>
            <code style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.1em' }}>{league.invite_code}</code>
            <button onClick={() => { navigator.clipboard.writeText(league.invite_code!); toast.success('Copied!'); }} style={{ ...S.btnGhost, padding: '2px 8px', fontSize: 11 }}>Copy</button>
          </div>
        )}
        {myTeams.length > 0 && !isOrganizer && (
          <div style={{ marginTop: 10 }}>
            <select onChange={(e) => { if (e.target.value) joinWithTeam(e.target.value); e.target.value = ''; }} style={{ ...S.input, width: 'auto' }} defaultValue="" disabled={joining}>
              <option value="" disabled>Join with a team…</option>
              {myTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Pending approvals (organizer only) */}
      {isOrganizer && pending.length > 0 && (
        <div>
          <h3 style={S.sectionTitle}>Pending Approval ({pending.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pending.map((e) => (
              <div key={e.team_id} style={S.teamRow}>
                <Users size={14} color="var(--text-3)" />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{e.team_name ?? e.team_id}</span>
                <button onClick={() => approve(e.team_id)} style={{ ...S.btnPrimary, padding: '4px 10px', fontSize: 12 }}><Check size={12} style={{ marginRight: 4 }} />Approve</button>
                <button onClick={() => remove(e.team_id)} style={{ ...S.btnGhost, padding: '4px 8px', fontSize: 12 }}><X size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member Teams */}
      <div>
        <h3 style={S.sectionTitle}>Teams ({approved.length})</h3>
        {approved.length === 0 && <p style={S.muted}>No approved teams yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {approved.map((e) => (
            <div key={e.team_id} style={S.teamRow}>
              <Users size={14} color="var(--text-3)" />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{e.team_name ?? e.team_id}</span>
              {isOrganizer && (
                <button onClick={() => remove(e.team_id)} style={{ ...S.btnGhost, padding: '4px 8px', fontSize: 12 }}><X size={12} /></button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Announcements */}
      <div>
        <h3 style={S.sectionTitle}>Announcements</h3>
        {isOrganizer && (
          <form onSubmit={postAnnouncement} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={announcement} onChange={(e) => setAnnouncement(e.target.value)} style={{ ...S.input, marginTop: 0, flex: 1 }} placeholder="Post an announcement…" maxLength={1000} />
            <button type="submit" disabled={posting} style={S.btnPrimary}><Megaphone size={14} /></button>
          </form>
        )}
        {announcements.length === 0 && <p style={S.muted}>No announcements yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {announcements.map((a) => (
            <div key={a.id} style={S.announcement}>
              <p style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--text-1)', whiteSpace: 'pre-wrap' }}>{a.body}</p>
              <p style={S.muted}>{new Date(a.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeaguePage() {
  const user = useAuthStore((s) => s.user)!;
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selected, setSelected] = useState<{ league: League; teams: LeagueTeamEntry[]; announcements: LeagueAnnouncement[] } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await leaguesApi.list({ limit: 30 });
      setLeagues(data.leagues);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectLeague = async (id: string) => {
    const { data } = await leaguesApi.get(id);
    setSelected({ league: data.league, teams: data.teams, announcements: data.announcements });
  };

  if (loading) return <div style={S.loading}>Loading leagues…</div>;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.headerLeft}><Award size={22} color="#34d399" /><h1 style={S.title}>Leagues</h1></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowJoinCode(true)} style={S.btnGhost}>Join by Code</button>
          <button onClick={() => setShowCreate(true)} style={S.btnPrimary}><Plus size={14} style={{ marginRight: 4 }} />New League</button>
        </div>
      </div>

      <div style={S.layout}>
        <div style={S.list}>
          {leagues.length === 0 && <p style={S.muted}>No leagues found.</p>}
          {leagues.map((l) => (
            <div key={l.id} onClick={() => selectLeague(l.id)}
              style={{ ...S.card, ...(selected?.league.id === l.id ? S.cardActive : {}) }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={S.cardTitle}>{l.name}</p>
                <p style={S.muted}>{l.visibility}{l.season ? ` • ${l.season}` : ''}</p>
              </div>
              <ChevronRight size={14} color="var(--text-4)" />
            </div>
          ))}
        </div>

        <div style={S.detail}>
          {!selected ? (
            <p style={S.muted}>Select a league to view details.</p>
          ) : (
            <LeagueDetail
              league={selected.league}
              teams={selected.teams}
              announcements={selected.announcements}
              userId={user.id}
              onRefresh={() => selectLeague(selected.league.id)}
            />
          )}
        </div>
      </div>

      {showCreate && (
        <CreateLeagueModal
          onClose={() => setShowCreate(false)}
          onCreated={(l) => {
            setLeagues((prev) => [l, ...prev]);
            setShowCreate(false);
            selectLeague(l.id);
          }}
        />
      )}
      {showJoinCode && <JoinByCodeModal onClose={() => setShowJoinCode(false)} onJoined={load} />}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  page:         { maxWidth: 1100, margin: '0 auto', padding: '24px 16px' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerLeft:   { display: 'flex', alignItems: 'center', gap: 10 },
  title:        { margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-1)' },
  layout:       { display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 },
  list:         { display: 'flex', flexDirection: 'column', gap: 6 },
  card:         { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-1)', background: 'var(--bg-2)', cursor: 'pointer' },
  cardActive:   { borderColor: '#34d399', background: 'var(--bg-3)' },
  cardTitle:    { margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  detail:       { background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border-1)', padding: 20, minHeight: 200 },
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
  teamRow:      { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-1)', background: 'var(--bg-3)' },
  announcement: { padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-1)', background: 'var(--bg-3)' },
};
