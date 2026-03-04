import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi, getErrorMessage } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authApi.login(email, password);
      setAuth(data.token, data.user);
      navigate('/');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyles.container}>
      <div style={pageStyles.card}>
        <h1 style={pageStyles.title}>♟ Chess Insight Engine</h1>
        <h2 style={pageStyles.subtitle}>Sign in to your account</h2>
        <form onSubmit={handleSubmit} style={pageStyles.form}>
          <label style={pageStyles.label}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={pageStyles.input}
              placeholder="you@example.com"
            />
          </label>
          <label style={pageStyles.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={pageStyles.input}
              placeholder="••••••••"
            />
          </label>
          <button type="submit" disabled={loading} style={pageStyles.btn}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p style={pageStyles.footer}>
          Don't have an account?{' '}
          <Link to="/register" style={pageStyles.link}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

const pageStyles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    background: 'var(--bg-app)',
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-strong)',
    borderRadius: 12,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 420,
    boxShadow: 'var(--shadow-lg)',
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--text-1)',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: 400,
    color: 'var(--text-3)',
    textAlign: 'center',
    marginBottom: 28,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 14,
    color: 'var(--text-2)',
  },
  input: {
    background: 'var(--bg-input)',
    border: '1px solid var(--border-strong)',
    borderRadius: 8,
    padding: '10px 14px',
    color: 'var(--text-1)',
    fontSize: 15,
    outline: 'none',
  },
  btn: {
    marginTop: 8,
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '12px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  footer: { textAlign: 'center', marginTop: 20, color: 'var(--text-4)', fontSize: 14 },
  link: { color: '#3b82f6', textDecoration: 'none' },
};
