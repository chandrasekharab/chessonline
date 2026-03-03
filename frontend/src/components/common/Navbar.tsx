import { Link, useNavigate } from 'react-router-dom';
import { LogOut, User, Swords, GraduationCap } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { disconnectSocket } from '../../services/socket';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

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
      </div>
      <div style={styles.right}>
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
};
