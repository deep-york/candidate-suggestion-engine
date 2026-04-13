import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Candidates from './pages/Candidates';
import Jobs from './pages/Jobs';

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgba(9,9,10,0.90)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: '0 auto',
            padding: '0 24px',
            height: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              className="font-display"
              style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.02em', lineHeight: 1 }}
            >
              CSE
            </span>
            <span style={{ width: 1, height: 18, background: 'var(--border-strong)' }} />
            <span
              className="font-mono"
              style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.24em', color: 'var(--text-2)' }}
            >
              Intelligence
            </span>
          </div>

          {/* Links */}
          <div style={{ display: 'flex', alignItems: 'stretch', height: 52 }}>
            {[
              { to: '/', label: 'Overview' },
              { to: '/candidates', label: 'Candidates' },
              { to: '/jobs', label: 'Jobs' },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                style={({ isActive }) => ({
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: 10,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.16em',
                  padding: '0 14px',
                  display: 'flex',
                  alignItems: 'center',
                  color: isActive ? 'var(--accent)' : 'var(--text-2)',
                  textDecoration: 'none',
                  borderBottom: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                  transition: 'color 0.15s',
                })}
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Main ───────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '40px 24px' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/candidates" element={<Candidates />} />
          <Route path="/jobs" element={<Jobs />} />
        </Routes>
      </main>
    </div>
  );
}
