import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export default function Dashboard() {
  const candidatesQ = useQuery({
    queryKey: ['candidates', 1],
    queryFn: () => apiClient.listCandidates(1),
  });
  const jobsQ = useQuery({
    queryKey: ['jobs'],
    queryFn: () => apiClient.listJobs(),
  });

  const recentJobs = jobsQ.data?.data.slice(0, 8) ?? [];

  return (
    <div className="anim-fade-up">
      {/* Page heading */}
      <div style={{ marginBottom: 44, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
        <h1
          className="font-display"
          style={{ fontSize: 42, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.025em', lineHeight: 1.1 }}
        >
          Intelligence Overview
        </h1>
        <p
          className="font-mono"
          style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 8, letterSpacing: '0.16em', textTransform: 'uppercase' }}
        >
          Candidate Suggestion Engine · Local Workspace
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, marginBottom: 44 }}>
        {[
          { value: candidatesQ.data?.total ?? '—', label: 'Candidates Indexed', loading: candidatesQ.isLoading },
          { value: jobsQ.data?.total ?? '—', label: 'Active Roles', loading: jobsQ.isLoading },
        ].map((s, i) => (
          <div
            key={s.label}
            className={`cse-card anim-fade-up d-${i + 1}`}
            style={{ padding: '36px 40px' }}
          >
            <div
              className="font-display"
              style={{
                fontSize: 80,
                fontWeight: 300,
                lineHeight: 1,
                letterSpacing: '-0.05em',
                color: s.loading ? 'var(--text-3)' : 'var(--text-1)',
                marginBottom: 14,
                transition: 'color 0.3s',
              }}
            >
              {s.value}
            </div>
            <div className="cse-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent jobs table */}
      <div className="anim-fade-up d-3">
        <div style={{ marginBottom: 14 }}>
          <span className="cse-label">Recent Role Openings</span>
        </div>

        {jobsQ.isLoading && (
          <p className="font-mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.1em' }}>LOADING…</p>
        )}

        {!jobsQ.isLoading && recentJobs.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
            No job descriptions yet. Upload a JD on the Jobs page.
          </p>
        )}

        {recentJobs.length > 0 && (
          <div className="cse-card" style={{ overflow: 'hidden' }}>
            {recentJobs.map((j, i) => (
              <div
                key={j.id}
                className={`anim-fade-up d-${Math.min(i + 4, 10)}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  borderBottom: i < recentJobs.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: 14, color: 'var(--text-1)' }}>{j.title}</span>
                <span
                  className="font-mono"
                  style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.06em' }}
                >
                  {new Date(j.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
