import { Link, useNavigate } from 'react-router-dom';
import { LogOut, User, Swords, GraduationCap, Puzzle, Palette } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { disconnectSocket } from '../../services/socket';
import { useBoardThemeStore, BOARD_THEMES } from '../../store/boardThemeStore';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { themeName, setTheme } = useBoardThemeStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  const handleLogout = () => {
    disconnectSocket();
    logout();
    navigate('/login');
  };

  return (
    <nav style={styles.nav}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <Link to="/" style={styles.brand}>
          ♟ Chess Insight
        </Link>
        <Link to="/play" style={styles.playLink}>
          <Swords size={15} style={{ marginRight: 5 }} />
          Play
        </Link>
        <Link to="/tutorial" style={styles.tutorialLink}>
          <GraduationCap size={15} style={{ marginRight: 5 }} />
          Tutorial
        </Link>
        <Link to="/puzzles" style={styles.puzzleLink}>
          <Puzzle size={15} style={{ marginRight: 5 }} />
          Puzzles
        </Link>
      </div>
      <div style={styles.right}>
        {/* Board theme picker */}
        <div ref={pickerRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setPickerOpen((o) => !o)}
            style={{ ...styles.iconBtn, ...(pickerOpen ? styles.iconBtnActive : {}) }}
            title="Board theme"
          >
            <Palette size={16} />
          </button>
          {pickerOpen && (
            <div style={styles.picker}>
              <p style={styles.pickerTitle}>Board Theme</p>
              <div style={styles.swatchGrid}>
                {BOARD_THEMES.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => { setTheme(t.name); setPickerOpen(false); }}
                    title={t.label}
                    style={{
                      ...styles.swatchBtn,
                      outline: themeName === t.name ? '2px solid #60a5fa' : '2px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', width: 36, height: 36, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ flex: 1, background: t.light }} />
                      <div style={{ flex: 1, background: t.dark }} />
                    </div>
                    <span style={styles.swatchLabel}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <span style={styles.email}>
          <User size={15} style={{ marginRight: 6 }} />
          {user?.email}
        </span>
        <button onClick={handleLogout} style={styles.logoutBtn} title="Logout">
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    height: 56,
    background: '#0f172a',
    borderBottom: '1px solid #1e293b',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brand: {
    color: '#f8fafc',
    fontWeight: 700,
    fontSize: 18,
    textDecoration: 'none',
    letterSpacing: '-0.3px',
  },
  playLink: {
    display: 'flex',
    alignItems: 'center',
    color: '#60a5fa',
    fontWeight: 600,
    fontSize: 15,
    textDecoration: 'none',
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #1e3a5f',
    background: '#0c2340',
    transition: 'background 0.2s',
  },
  tutorialLink: {
    display: 'flex',
    alignItems: 'center',
    color: '#86efac',
    fontWeight: 600,
    fontSize: 15,
    textDecoration: 'none',
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #14532d',
    background: '#052e16',
    transition: 'background 0.2s',
  },
  puzzleLink: {
    display: 'flex',
    alignItems: 'center',
    color: '#fbbf24',
    fontWeight: 600,
    fontSize: 15,
    textDecoration: 'none',
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #78350f',
    background: '#1c0a00',
    transition: 'background 0.2s',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  email: {
    display: 'flex',
    alignItems: 'center',
    color: '#94a3b8',
    fontSize: 14,
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'transparent',
    border: '1px solid #334155',
    color: '#94a3b8',
    padding: '6px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    transition: 'color 0.2s, border-color 0.2s',
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    background: 'transparent',
    border: '1px solid #334155',
    color: '#94a3b8',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'color 0.2s, border-color 0.2s',
  },
  iconBtnActive: {
    border: '1px solid #60a5fa',
    color: '#60a5fa',
    background: '#0c2340',
  },
  picker: {
    position: 'absolute',
    top: 40,
    right: 0,
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 12,
    padding: '12px 14px',
    zIndex: 200,
    minWidth: 260,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  pickerTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    margin: '0 0 10px',
  },
  swatchGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 8,
  },
  swatchBtn: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 3,
    borderRadius: 6,
    outlineOffset: 2,
  },
  swatchLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 500,
  },
};
