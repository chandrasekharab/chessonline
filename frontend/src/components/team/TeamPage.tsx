import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Trophy, Shield, Crown, Star, Trash2, Link, Copy, Check, X } from 'lucide-react';
import { teamsApi, getErrorMessage } from '../../services/api';
import type { Team, TeamMember, TeamRole, TeamInvite } from '../../types';
import toast from 'react-hot-toast';

const ROLE_ICONS: Record<TeamRole, React.ElementType> = {
  captain: Crown,
  coach:   Star,
  player:  Shield,
};

const ROLE_COLORS: Record<TeamRole, string> = {
  captain: '#f59e0b',
  coach:   '#8b5cf6',
  player:  '#60a5fa',
};

// ── Create Team Modal ─────────────────────────────────────────────────────────

function CreateTeamModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: Team) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data } = await teamsApi.create({ name: name.trim(), description: description.trim() || undefined, logo_url: logoUrl.trim() || undefined });
      onCreated(data.team);
      toast.success(`Team "${data.team.name}" created!`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <h2 style={S.modalTitle}><Users size={18} style={{ marginRight: 8 }} />Create Team</h2>
          <button onClick={onClose} style={S.closeBtn}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={S.label}>Team Name *</label>
            <input style={S.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chess Tigers" maxLength={80} required />
          </div>
          <div>
            <label style={S.label}>Description</label>
            <textarea style={{ ...S.input, height: 80, resize: 'vertical' }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional team bio…" maxLength={500} />
          </div>
          <div>
            <label style={S.label}>Logo URL</label>
            <input style={S.input} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={S.btnGhost}>Cancel</button>
            <button type="submit" disabled={loading} style={S.btnPrimary}>{loading ? 'Creating…' : 'Create Team'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Invite Modal ──────────────────────────────────────────────────────────────

function InviteModal({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    teamsApi.getInvites(teamId).then((r) => setInvites(r.data.invites)).catch(() => {});
  }, [teamId]);

  const createLink = async () => {
    setLoading(true);
    try {
      const { data } = await teamsApi.createInviteLink(teamId);
      setInvites((prev) => [data.invite, ...prev]);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  };

  const copyLink = (token: string) => {
    void navigator.clipboard.writeText(`${window.location.origin}/teams/invite/${token}`);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const revoke = async (inviteId: string) => {
    await teamsApi.revokeInvite(teamId, inviteId);
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={S.modalHeader}>
          <h2 style={S.modalTitle}><Link size={18} style={{ marginRight: 8 }} />Invite Links</h2>
          <button onClick={onClose} style={S.closeBtn}><X size={18} /></button>
        </div>
        <button onClick={createLink} disabled={loading} style={{ ...S.btnPrimary, marginBottom: 12 }}>
          <Plus size={14} style={{ marginRight: 4 }} />{loading ? 'Creating…' : 'New Invite Link'}
        </button>
        {invites.length === 0 && <p style={S.muted}>No invite links yet.</p>}
        {invites.map((inv) => (
          <div key={inv.id} style={S.inviteRow}>
            <code style={S.tokenCode}>{inv.token}</code>
            <span style={S.muted}>{inv.use_count}/{inv.max_uses ?? '∞'} uses</span>
            <button onClick={() => copyLink(inv.token)} style={S.iconBtn} title="Copy link">
              {copied === inv.token ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
            </button>
            <button onClick={() => revoke(inv.id)} style={S.iconBtn} title="Revoke"><Trash2 size={14} color="#ef4444" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Team Page ────────────────────────────────────────────────────────────

export default function TeamPage() {
  const navigate = useNavigate();
  const [myTeams, setMyTeams] = useState<(Team & { role: TeamRole })[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<{ team: Team; members: TeamMember[] } | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [tab, setTab] = useState<'my' | 'browse'>('my');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [myRes, allRes] = await Promise.all([
        teamsApi.myTeams(),
        teamsApi.list(undefined, 20),
      ]);
      setMyTeams(myRes.data.teams);
      setAllTeams(allRes.data.teams);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSearch = async () => {
    if (!search.trim()) return;
    const { data } = await teamsApi.list(search.trim());
    setAllTeams(data.teams);
  };

  const selectTeam = async (teamId: string) => {
    const { data } = await teamsApi.get(teamId);
    setSelectedTeam({ team: data.team, members: data.members });
  };

  const myRole = selectedTeam
    ? (myTeams.find((t) => t.id === selectedTeam.team.id)?.role ?? null)
    : null;

  if (loading) return <div style={S.loading}>Loading teams…</div>;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.headerLeft}>
          <Users size={22} color="#60a5fa" />
          <h1 style={S.title}>Teams</h1>
        </div>
        <button onClick={() => { setShowCreate(true); }} style={S.btnPrimary}>
          <Plus size={14} style={{ marginRight: 4 }} />New Team
        </button>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {(['my', 'browse'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }}>
            {t === 'my' ? 'My Teams' : 'Browse'}
          </button>
        ))}
      </div>

      {tab === 'browse' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            style={{ ...S.input, flex: 1 }} value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search teams…"
          />
          <button onClick={handleSearch} style={S.btnGhost}>Search</button>
        </div>
      )}

      <div style={S.layout}>
        {/* Team list */}
        <div style={S.teamList}>
          {(tab === 'my' ? myTeams : allTeams).length === 0 && (
            <p style={S.muted}>{tab === 'my' ? 'You are not in any team yet.' : 'No teams found.'}</p>
          )}
          {(tab === 'my' ? myTeams : allTeams).map((team) => (
            <div key={team.id}
              onClick={() => selectTeam(team.id)}
              style={{ ...S.teamCard, ...(selectedTeam?.team.id === team.id ? S.teamCardActive : {}) }}>
              {team.logo_url
                ? <img src={team.logo_url} alt="" style={S.logo} />
                : <div style={S.logoPlaceholder}>{team.name[0].toUpperCase()}</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={S.teamName}>{team.name}</p>
                <p style={S.muted}>⚡ {team.rating} • {team.wins}W {team.draws}D {team.losses}L</p>
              </div>
              {'role' in team && (
                <span style={{ ...S.roleBadge, background: ROLE_COLORS[(team as { role: TeamRole }).role] + '22', color: ROLE_COLORS[(team as { role: TeamRole }).role] }}>
                  {(team as { role: TeamRole }).role}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Team detail */}
        {selectedTeam && (
          <div style={S.detail}>
            <div style={S.detailHeader}>
              {selectedTeam.team.logo_url
                ? <img src={selectedTeam.team.logo_url} alt="" style={S.logoLg} />
                : <div style={S.logoPlaceholderLg}>{selectedTeam.team.name[0].toUpperCase()}</div>}
              <div>
                <h2 style={S.detailTitle}>{selectedTeam.team.name}</h2>
                {selectedTeam.team.description && <p style={S.muted}>{selectedTeam.team.description}</p>}
                <p style={S.statRow}>
                  <Trophy size={14} color="#f59e0b" style={{ marginRight: 4 }} />
                  Rating: <strong style={{ marginLeft: 4 }}>{selectedTeam.team.rating}</strong>
                  <span style={S.statDivider}>|</span>
                  W:{selectedTeam.team.wins} / D:{selectedTeam.team.draws} / L:{selectedTeam.team.losses}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {(myRole === 'captain' || myRole === 'coach') && (
                <button onClick={() => setShowInvite(true)} style={S.btnGhost}>
                  <Link size={14} style={{ marginRight: 4 }} />Invite Links
                </button>
              )}
              {!myRole && tab === 'browse' && (
                <p style={S.muted}>Ask a captain for an invite link to join.</p>
              )}
              <button onClick={() => navigate(`/tournaments?team=${selectedTeam.team.id}`)} style={S.btnGhost}>
                <Trophy size={14} style={{ marginRight: 4 }} />Tournaments
              </button>
            </div>

            {/* Members */}
            <h3 style={S.sectionTitle}>Members ({selectedTeam.members.length})</h3>
            {selectedTeam.members.map((m) => {
              const RoleIcon = ROLE_ICONS[m.role];
              return (
                <div key={m.user_id} style={S.memberRow}>
                  <div style={S.memberAvatar}>{(m.email ?? '?')[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={S.memberEmail}>{m.email ?? m.user_id}</p>
                    <p style={S.muted}>Rating: {m.rating ?? 'N/A'}</p>
                  </div>
                  <span style={{ ...S.roleBadge, background: ROLE_COLORS[m.role] + '22', color: ROLE_COLORS[m.role] }}>
                    <RoleIcon size={12} style={{ marginRight: 3 }} />{m.role}
                  </span>
                  {myRole === 'captain' && m.user_id !== selectedTeam.team.captain_id && (
                    <button
                      onClick={async () => {
                        await teamsApi.removeMember(selectedTeam.team.id, m.user_id);
                        setSelectedTeam((prev) => prev ? { ...prev, members: prev.members.filter((x) => x.user_id !== m.user_id) } : prev);
                        toast.success('Member removed');
                      }}
                      style={{ ...S.iconBtn, marginLeft: 4 }} title="Remove">
                      <Trash2 size={13} color="#ef4444" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateTeamModal
          onClose={() => setShowCreate(false)}
          onCreated={(t) => {
            setMyTeams((prev) => [...prev, { ...t, role: 'captain' as TeamRole }]);
            setShowCreate(false);
            selectTeam(t.id);
          }}
        />
      )}
      {showInvite && selectedTeam && (
        <InviteModal teamId={selectedTeam.team.id} onClose={() => setShowInvite(false)} />
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
  teamList:     { display: 'flex', flexDirection: 'column', gap: 6 },
  teamCard:     { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-1)', background: 'var(--bg-2)', cursor: 'pointer', transition: 'border-color 0.15s' },
  teamCardActive: { borderColor: '#60a5fa', background: 'var(--bg-3)' },
  logo:         { width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 },
  logoPlaceholder: { width: 36, height: 36, borderRadius: 6, background: 'var(--bg-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--text-1)', flexShrink: 0 },
  logoLg:       { width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0 },
  logoPlaceholderLg: { width: 56, height: 56, borderRadius: 10, background: 'var(--bg-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--text-1)', flexShrink: 0 },
  teamName:     { margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  roleBadge:    { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, display: 'flex', alignItems: 'center', flexShrink: 0 },
  detail:       { background: 'var(--bg-2)', borderRadius: 10, border: '1px solid var(--border-1)', padding: 20 },
  detailHeader: { display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  detailTitle:  { margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' },
  statRow:      { display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-3)', margin: '6px 0 0' },
  statDivider:  { margin: '0 6px', color: 'var(--border-1)' },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: 'var(--text-2)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  memberRow:    { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-1)' },
  memberAvatar: { width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text-1)', flexShrink: 0 },
  memberEmail:  { margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-1)' },
  muted:        { margin: 0, fontSize: 12, color: 'var(--text-4)' },
  input:        { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-1)', background: 'var(--bg-3)', color: 'var(--text-1)', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  label:        { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4 },
  btnPrimary:   { display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnGhost:     { display: 'flex', alignItems: 'center', padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border-1)', background: 'transparent', color: 'var(--text-2)', fontWeight: 500, fontSize: 13, cursor: 'pointer' },
  iconBtn:      { background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', color: 'var(--text-3)' },
  loading:      { textAlign: 'center', padding: 60, color: 'var(--text-4)' },
  overlay:      { position: 'fixed', inset: 0, background: '#0009', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:        { background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border-1)', padding: 24, width: 420, maxWidth: '95vw' },
  modalHeader:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle:   { margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-1)', display: 'flex', alignItems: 'center' },
  closeBtn:     { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2 },
  inviteRow:    { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-1)' },
  tokenCode:    { flex: 1, fontSize: 12, fontFamily: 'monospace', color: 'var(--text-2)', wordBreak: 'break-all' },
};
