import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useUpload } from '../hooks/useUpload';
import { useLatestMatches, useRunMatch, useDeleteJob } from '../hooks/useMatches';
import UploadZone from '../components/UploadZone';
import RankingList from '../components/RankingList';
import JdModal from '../components/JdModal';

// ── Spinner ───────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="anim-spin" width="12" height="12" fill="none" viewBox="0 0 24 24">
      <circle opacity="0.2" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ── Match panel ───────────────────────────────────────────────────
function JobMatchPanel({ jobId }: { jobId: string }) {
  const matches = useLatestMatches(jobId);
  const runMatch = useRunMatch(jobId);
  const results = runMatch.data ?? matches.data;
  const hasResults = (results?.candidates ?? []).length > 0;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <span className="cse-label">Top Candidates</span>
          {results && (
            <p
              className="font-mono"
              style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 4, letterSpacing: '0.06em' }}
            >
              {new Date(results.ranAt).toLocaleString()} · {results.modelUsed}
            </p>
          )}
        </div>
        <button
          data-testid="run-match"
          disabled={runMatch.isPending}
          onClick={() => runMatch.mutate()}
          className="cse-btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {runMatch.isPending && <Spinner />}
          {runMatch.isPending ? 'Matching…' : 'Run Match'}
        </button>
      </div>

      {/* Error */}
      {runMatch.isError && (
        <div
          style={{
            marginBottom: 16,
            padding: '10px 14px',
            background: 'var(--red-dim)',
            border: '1px solid var(--red)',
            fontSize: 12,
            color: 'var(--red)',
          }}
        >
          {(runMatch.error as Error).message}
        </div>
      )}

      {hasResults && results ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <RankingList candidates={results.candidates} />
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          {runMatch.isPending ? (
            <p
              className="font-mono"
              style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: '0.14em', textTransform: 'uppercase' }}
            >
              Scanning candidate database…
            </p>
          ) : matches.isLoading ? (
            <p className="font-mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Loading…
            </p>
          ) : (
            <div>
              <div
                className="font-display"
                style={{ fontSize: 56, fontWeight: 300, color: 'var(--text-3)', lineHeight: 1, marginBottom: 12 }}
              >
                —
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-2)' }}>No match results yet</p>
              <p
                className="font-mono"
                style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 5, letterSpacing: '0.12em', textTransform: 'uppercase' }}
              >
                Click Run Match to generate top-10
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Debounce ──────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timer.current = setTimeout(() => setDebounced(value), delay);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, delay]);
  return debounced;
}

// ── Main ──────────────────────────────────────────────────────────
export default function Jobs() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [jdModalJobId, setJdModalJobId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search);
  const deleteJob = useDeleteJob();
  const uploadHook = useUpload('jd');

  const jobs = useQuery({
    queryKey: ['jobs', debouncedSearch, page],
    queryFn: () => apiClient.listJobs(debouncedSearch, page),
  });

  const jobList = jobs.data?.data ?? [];
  const total = jobs.data?.total ?? 0;
  const limit = jobs.data?.limit ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const effectiveSelected = selectedJobId ?? (jobList[0]?.id ?? null);

  function handleDelete(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This will also remove all match results.`)) return;
    deleteJob.mutate(id, {
      onSuccess: () => { if (selectedJobId === id) setSelectedJobId(null); },
    });
  }

  return (
    <div className="anim-fade-up">
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 28,
          paddingBottom: 20,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <h1
            className="font-display"
            style={{ fontSize: 42, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.025em', lineHeight: 1.1 }}
          >
            Jobs
          </h1>
          {!jobs.isLoading && (
            <p
              className="font-mono"
              style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 6, letterSpacing: '0.14em', textTransform: 'uppercase' }}
            >
              {total === 0 ? 'No active roles' : `${total} active role${total !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="cse-btn"
          style={{ display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Upload JD
        </button>
      </div>

      {/* Upload zone */}
      {showUpload && (
        <div className="anim-fade-up" style={{ marginBottom: 24 }}>
          <UploadZone hook={uploadHook} label="Upload job description (PDF or DOCX)" />
          {uploadHook.state.stage === 'done' && (
            <button
              onClick={() => { uploadHook.reset(); setShowUpload(false); }}
              className="font-mono"
              style={{
                marginTop: 8,
                fontSize: 9,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-2)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Close ↑
            </button>
          )}
        </div>
      )}

      {jobs.isLoading && (
        <p
          className="font-mono"
          style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase', textAlign: 'center', padding: '48px 0' }}
        >
          Loading…
        </p>
      )}

      {/* Empty state */}
      {!jobs.isLoading && jobList.length === 0 && !search && (
        <div style={{ textAlign: 'center', padding: '72px 0' }}>
          <div className="font-display" style={{ fontSize: 64, fontWeight: 300, color: 'var(--text-3)', marginBottom: 14 }}>—</div>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>No job descriptions yet.</p>
          <button
            onClick={() => setShowUpload(true)}
            className="font-mono"
            style={{
              marginTop: 10,
              fontSize: 9,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Upload your first JD →
          </button>
        </div>
      )}

      {/* Two-panel layout */}
      {(jobList.length > 0 || search) && (
        <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
          {/* ── Left sidebar ── */}
          <div style={{ width: 232, flexShrink: 0, position: 'sticky', top: 68, paddingRight: 20, borderRight: '1px solid var(--border)' }}>
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <svg
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 11, height: 11, color: 'var(--text-2)', pointerEvents: 'none' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Filter roles…"
                className="cse-input"
                style={{ paddingLeft: 28, fontSize: 12 }}
              />
            </div>

            {/* Job list */}
            <div>
              {jobList.length === 0 && (
                <p className="font-mono" style={{ fontSize: 9, color: 'var(--text-3)', padding: '20px 0', textAlign: 'center', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  No roles found
                </p>
              )}
              {jobList.map((j, i) => {
                const active = effectiveSelected === j.id;
                return (
                  <div
                    key={j.id}
                    className={`anim-fade-up d-${Math.min(i + 1, 10)}`}
                    style={{
                      borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                      borderBottom: '1px solid var(--border)',
                      transition: 'border-left-color 0.15s, background 0.15s',
                      marginLeft: -2,
                      paddingLeft: 2,
                      background: active ? 'rgba(201,150,74,0.05)' : 'transparent',
                    }}
                  >
                    <button
                      onClick={() => setSelectedJobId(j.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 10px 5px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: active ? 'var(--accent)' : 'var(--text-1)',
                          lineHeight: 1.3,
                          transition: 'color 0.15s',
                        }}
                      >
                        {j.title}
                      </p>
                      <p
                        className="font-mono"
                        style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 3, letterSpacing: '0.06em' }}
                      >
                        {new Date(j.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </button>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 8px 8px', gap: 2 }}>
                      <button
                        onClick={() => setJdModalJobId(j.id)}
                        className="font-mono"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-2)',
                          padding: '3px 6px',
                          fontSize: 9,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-2)')}
                      >
                        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </button>
                      <button
                        onClick={() => handleDelete(j.id, j.title)}
                        disabled={deleteJob.isPending}
                        aria-label="Delete job"
                        style={{
                          marginLeft: 'auto',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-3)',
                          padding: '3px 5px',
                          display: 'flex',
                          alignItems: 'center',
                          opacity: deleteJob.isPending ? 0.35 : 1,
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--red)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-3)')}
                      >
                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sidebar pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 }}>
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="cse-btn"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                >←</button>
                <span className="font-mono" style={{ fontSize: 9, color: 'var(--text-2)', letterSpacing: '0.1em' }}>
                  {page}/{totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="cse-btn"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                >→</button>
              </div>
            )}
          </div>

          {/* ── Right panel ── */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              paddingLeft: 32,
              minHeight: 500,
            }}
          >
            {effectiveSelected ? (
              <JobMatchPanel jobId={effectiveSelected} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320 }}>
                <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Select a role to see matches</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* JD Modal */}
      {jdModalJobId && (
        <JdModal jobId={jdModalJobId} onClose={() => setJdModalJobId(null)} />
      )}
    </div>
  );
}


