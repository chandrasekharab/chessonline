import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { useUIThemeStore } from './store/uiThemeStore';
import Navbar from './components/common/Navbar';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/dashboard/Dashboard';
import GameView from './components/game/GameView';
import MatchmakingLobby from './components/live/MatchmakingLobby';
import TutorialPage from './components/tutorial/TutorialPage';
import PuzzlePage from './components/puzzle/PuzzlePage';
import ProtectedRoute from './components/common/ProtectedRoute';
import TeamPage from './components/team/TeamPage';
import TournamentPage from './components/tournament/TournamentPage';
import LeaguePage from './components/league/LeaguePage';
import ConsultationBoard from './components/consultation/ConsultationBoard';

export default function App() {
  const user = useAuthStore((s) => s.user);
  const { theme, resolved } = useUIThemeStore();

  // Apply theme to <html data-theme="...">
  useEffect(() => {
    const applyTheme = () => {
      document.documentElement.setAttribute('data-theme', resolved());
    };
    applyTheme();
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      mq.addEventListener('change', applyTheme);
      return () => mq.removeEventListener('change', applyTheme);
    }
  }, [theme, resolved]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)', color: 'var(--text-2)' }}>
      {user && <Navbar />}
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/games/:id" element={<GameView />} />
            <Route path="/play" element={<MatchmakingLobby />} />
            <Route path="/tutorial" element={<TutorialPage />} />
            <Route path="/puzzles" element={<PuzzlePage />} />
            <Route path="/teams" element={<TeamPage />} />
            <Route path="/tournaments" element={<TournamentPage />} />
            <Route path="/leagues" element={<LeaguePage />} />
            <Route path="/consultation/:id?" element={<ConsultationBoard />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

