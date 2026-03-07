import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LogOut, User, Swords, GraduationCap, Puzzle, Palette,
  LayoutDashboard, Menu, X, ChevronRight, Sun, Moon, Monitor,
  Users, Trophy, Award, Users2,
} from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { disconnectSocket } from '../../services/socket';
import { useBoardThemeStore, BOARD_THEMES } from '../../store/boardThemeStore';
import { useUIThemeStore, UITheme } from '../../store/uiThemeStore';

const NAV_ITEMS = [
  { to: '/play',         label: 'Play',         Icon: Swords,        color: '#60a5fa', desc: 'Play live games against other players' },
  { to: '/tutorial',    label: 'Tutorial',    Icon: GraduationCap, color: '#34d399', desc: 'Learn chess concepts & openings' },
  { to: '/puzzles',     label: 'Puzzles',     Icon: Puzzle,        color: '#fbbf24', desc: 'Sharpen tactics with daily puzzles' },
  { to: '/teams',       label: 'Teams',       Icon: Users,         color: '#a78bfa', desc: 'Manage your teams' },
  { to: '/tournaments', label: 'Tournaments', Icon: Trophy,        color: '#f59e0b', desc: 'Compete in team tournaments' },
  { to: '/leagues',     label: 'Leagues',     Icon: Award,         color: '#34d399', desc: 'Join private club leagues' },
  { to: '/consultation',label: 'Consultation',Icon: Users2,        color: '#f472b6', desc: 'Play 2v2 consultation chess' },
];

const UI_THEMES: { value: UITheme; label: string; Icon: React.ElementType }[] = [
  { value: 'dark',   label: 'Dark',   Icon: Moon },
  { value: 'light',  label: 'Light',  Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor },
];

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { themeName, setTheme: setBoardTheme } = useBoardThemeStore();
  const { theme: uiTheme, setTheme: setUITheme } = useUIThemeStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uiThemeOpen, setUiThemeOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const uiThemeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [pickerOpen]);

  useEffect(() => {
    if (!uiThemeOpen) return;
    const h = (e: MouseEvent) => {
      if (uiThemeRef.current && !uiThemeRef.current.contains(e.target as Node)) setUiThemeOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [uiThemeOpen]);

  useEffect(() => { setPanelOpen(false); }, [pathname]);

  const handleLogout = () => {
    disconnectSocket();
    logout();
    navigate('/login');
  };

  const currentUIThemeItem = UI_THEMES.find((t) => t.value === uiTheme) ?? UI_THEMES[0];
  const UIThemeIcon = currentUIThemeItem.Icon;

  return (
    <>
      {/* Top nav bar */}
      <nav style={S.nav}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => setPanelOpen(true)} style={S.hamburger} title="Navigation">
            <Menu size={18} />
          </button>
          <Link to="/" style={S.brand}>&#9816; Chess Insight</Link>
          <div style={S.divider} />
          {NAV_ITEMS.map(({ to, label, Icon, color }) => {
            const active = pathname === to || pathname.startsWith(to + '/');
            return (
              <Link key={to} to={to} style={{ ...S.navItem, ...(active ? { ...S.navItemActive, '--ni-color': color } as React.CSSProperties : {}) }}>
                <Icon size={14} style={{ color: active ? color : 'var(--text-4)', flexShrink: 0 }} />
                <span>{label}</span>
                {active && <span style={{ ...S.activeDot, background: color }} />}
              </Link>
            );
          })}
        </div>

        <div style={S.right}>
          {/* UI theme switcher */}
          <div ref={uiThemeRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setUiThemeOpen((o) => !o)}
              style={{ ...S.iconBtn, ...(uiThemeOpen ? S.iconBtnActive : {}) }}
              title={`UI Theme: ${currentUIThemeItem.label}`}
            >
              <UIThemeIcon size={16} />
            </button>
            {uiThemeOpen && (
              <div style={S.themePicker}>
                <p style={S.pickerTitle}>Interface Theme</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {UI_THEMES.map(({ value, label, Icon: TIcon }) => (
                    <button
                      key={value}
                      onClick={() => { setUITheme(value); setUiThemeOpen(false); }}
                      style={{ ...S.themeOption, ...(uiTheme === value ? S.themeOptionActive : {}) }}
                    >
                      <TIcon size={15} />
                      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
                      {uiTheme === value && (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', flexShrink: 0 }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Board theme picker */}
          <div ref={pickerRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setPickerOpen((o) => !o)}
              style={{ ...S.iconBtn, ...(pickerOpen ? S.iconBtnActive : {}) }}
              title="Board theme"
            >
              <Palette size={16} />
            </button>
            {pickerOpen && (
              <div style={S.picker}>
                <p style={S.pickerTitle}>Board Theme</p>
                <div style={S.swatchGrid}>
                  {BOARD_THEMES.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => { setBoardTheme(t.name); setPickerOpen(false); }}
                      title={t.label}
                      style={{ ...S.swatchBtn, outline: themeName === t.name ? '2px solid #60a5fa' : '2px solid transparent' }}
                    >
                      <div style={{ display: 'flex', width: 36, height: 36, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ flex: 1, background: t.light }} />
                        <div style={{ flex: 1, background: t.dark }} />
                      </div>
                      <span style={S.swatchLabel}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <span style={S.email}><User size={14} style={{ marginRight: 5 }} />{user?.email}</span>
          <button onClick={handleLogout} style={S.logoutBtn} title="Logout">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </nav>

      {/* Side nav panel backdrop */}
      <div
        onClick={() => setPanelOpen(false)}
        style={{ ...S.backdrop, opacity: panelOpen ? 1 : 0, pointerEvents: panelOpen ? 'auto' : 'none' }}
      />

      {/* Drawer */}
      <aside style={{ ...S.drawer, transform: panelOpen ? 'translateX(0)' : 'translateX(-100%)' }}>
        <div style={S.drawerHeader}>
          <span style={S.brand}>&#9816; Chess Insight</span>
          <button onClick={() => setPanelOpen(false)} style={S.closeBtn} title="Close"><X size={18} /></button>
        </div>

        <div style={S.drawerBody}>
          <Link to="/" style={{ ...S.panelItem, ...(pathname === '/' ? S.panelItemActive : {}) }}>
            <div style={{ ...S.panelIcon, background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)' }}>
              <LayoutDashboard size={17} style={{ color: '#60a5fa' }} />
            </div>
            <div style={S.panelText}>
              <span style={S.panelLabel}>My Games</span>
              <span style={S.panelDesc}>Browse & analyse your uploaded games</span>
            </div>
            <ChevronRight size={14} style={{ color: 'var(--border-strong)', marginLeft: 'auto', flexShrink: 0 }} />
          </Link>

          <div style={S.sectionLabel}>PLAY & LEARN</div>

          {NAV_ITEMS.map(({ to, label, Icon, color, desc }) => {
            const active = pathname === to || pathname.startsWith(to + '/');
            return (
              <Link key={to} to={to} style={{ ...S.panelItem, ...(active ? S.panelItemActive : {}) }}>
                <div style={{ ...S.panelIcon, background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)' }}>
                  <Icon size={17} style={{ color }} />
                </div>
                <div style={S.panelText}>
                  <span style={{ ...S.panelLabel, color: active ? color : 'var(--text-2)' }}>{label}</span>
                  <span style={S.panelDesc}>{desc}</span>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--border-strong)', marginLeft: 'auto', flexShrink: 0 }} />
              </Link>
            );
          })}

          <div style={S.sectionLabel}>APPEARANCE</div>
          <div style={{ padding: '4px 10px 8px', display: 'flex', gap: 6 }}>
            {UI_THEMES.map(({ value, label, Icon: TIcon }) => (
              <button
                key={value}
                onClick={() => setUITheme(value)}
                title={label}
                style={{ ...S.drawerThemeBtn, ...(uiTheme === value ? S.drawerThemeBtnActive : {}) }}
              >
                <TIcon size={14} />
                <span style={{ fontSize: 12 }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* user footer */}
        <div style={S.drawerFooter}>
          <div style={S.footerUser}>
            <div style={S.avatar}>{user?.email?.[0]?.toUpperCase() ?? 'U'}</div>
            <div>
              <div style={{ color: 'var(--text-1)', fontSize: 13, fontWeight: 600 }}>{user?.email}</div>
              <div style={{ color: 'var(--text-5)', fontSize: 11 }}>Signed in</div>
            </div>
          </div>
          <button onClick={handleLogout} style={S.footerLogout}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 20px', height: 56,
    background: 'var(--bg-nav)',
    borderBottom: '1px solid var(--border)',
    position: 'sticky', top: 0, zIndex: 100,
  },
  brand: { color: 'var(--text-1)', fontWeight: 700, fontSize: 17, textDecoration: 'none', letterSpacing: '-0.3px', padding: '0 6px' },
  divider: { width: 1, height: 22, background: 'var(--border-mid)', margin: '0 6px', flexShrink: 0 },
  hamburger: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34, background: 'transparent', border: '1px solid var(--border-mid)',
    color: 'var(--text-4)', borderRadius: 7, cursor: 'pointer',
    transition: 'border-color 0.15s, color 0.15s',
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 5, position: 'relative',
    color: 'var(--text-4)', fontWeight: 500, fontSize: 13, textDecoration: 'none',
    padding: '5px 10px', borderRadius: 7,
    transition: 'color 0.15s, background 0.15s',
  },
  navItemActive: {
    color: 'var(--text-2)', background: 'var(--bg-card)',
    border: '1px solid var(--border-mid)',
  },
  activeDot: {
    position: 'absolute', bottom: -1, left: '50%', transform: 'translateX(-50%)',
    width: 4, height: 4, borderRadius: '50%',
  },
  right: { display: 'flex', alignItems: 'center', gap: 12 },
  email: { display: 'flex', alignItems: 'center', color: 'var(--text-4)', fontSize: 13 },
  logoutBtn: {
    display: 'flex', alignItems: 'center', gap: 6, background: 'transparent',
    border: '1px solid var(--border-mid)', color: 'var(--text-4)',
    padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
    transition: 'color 0.15s, border-color 0.15s',
  },
  iconBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34, background: 'transparent', border: '1px solid var(--border-mid)',
    color: 'var(--text-4)', borderRadius: 6, cursor: 'pointer',
  },
  iconBtnActive: { border: '1px solid #60a5fa', color: '#60a5fa', background: 'var(--bg-elevated)' },

  themePicker: {
    position: 'absolute', top: 40, right: 0,
    background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 10,
    padding: '10px', zIndex: 200, minWidth: 160,
    boxShadow: 'var(--shadow)',
  },
  themeOption: {
    display: 'flex', alignItems: 'center', gap: 9,
    width: '100%', background: 'transparent', border: '1px solid transparent',
    color: 'var(--text-3)', padding: '8px 10px', borderRadius: 7,
    cursor: 'pointer', fontSize: 13, fontWeight: 500,
    transition: 'background 0.12s, color 0.12s',
  },
  themeOptionActive: {
    background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)',
    color: 'var(--text-1)',
  },

  picker: {
    position: 'absolute', top: 40, right: 0,
    background: 'var(--bg-card)', border: '1px solid var(--border-mid)', borderRadius: 12,
    padding: '12px 14px', zIndex: 200, minWidth: 260,
    boxShadow: 'var(--shadow)',
  },
  pickerTitle: { color: 'var(--text-4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' },
  swatchGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 },
  swatchBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 6, outlineOffset: 2 },
  swatchLabel: { color: 'var(--text-4)', fontSize: 10, fontWeight: 500 },

  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    zIndex: 200, transition: 'opacity 0.2s',
  },

  drawer: {
    position: 'fixed', top: 0, left: 0, bottom: 0,
    width: 300, background: 'var(--bg-drawer)',
    borderRight: '1px solid var(--border)',
    zIndex: 201, display: 'flex', flexDirection: 'column',
    transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
    boxShadow: '6px 0 32px rgba(0,0,0,0.25)',
  },
  drawerHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 16px', height: 56,
    borderBottom: '1px solid var(--border)', flexShrink: 0,
    background: 'var(--bg-nav)',
  },
  closeBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, background: 'transparent',
    border: '1px solid var(--border-mid)', color: 'var(--text-4)',
    borderRadius: 6, cursor: 'pointer',
  },
  drawerBody: { flex: 1, overflowY: 'auto', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 },
  sectionLabel: {
    color: 'var(--text-5)', fontSize: 10, fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    padding: '12px 10px 4px',
  },
  panelItem: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 10px', borderRadius: 9, textDecoration: 'none',
    color: 'var(--text-3)', transition: 'background 0.15s',
    border: '1px solid transparent',
  },
  panelItemActive: { background: 'var(--bg-card)', border: '1px solid var(--border-mid)' },
  panelIcon: { width: 38, height: 38, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  panelText: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  panelLabel: { color: 'var(--text-2)', fontWeight: 600, fontSize: 14 },
  panelDesc: { color: 'var(--text-5)', fontSize: 11, lineHeight: '1.3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },

  drawerThemeBtn: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    padding: '8px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 11,
    background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', color: 'var(--text-4)',
    fontWeight: 500, transition: 'background 0.12s, color 0.12s',
  },
  drawerThemeBtnActive: {
    background: 'var(--bg-surface)', border: '1px solid #60a5fa', color: '#60a5fa',
  },

  drawerFooter: {
    borderTop: '1px solid var(--border)', padding: '14px 16px',
    flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12,
  },
  footerUser: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: '50%',
    background: 'linear-gradient(135deg, #3730a3, #1e40af)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#e0e7ff', fontWeight: 700, fontSize: 15, flexShrink: 0,
  },
  footerLogout: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    background: 'transparent', border: '1px solid var(--border-mid)', color: 'var(--text-4)',
    borderRadius: 7, padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
  },
};
