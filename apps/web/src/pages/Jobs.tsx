import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useUpload } from '../hooks/useUpload';
import { useLatestMatches, useRunMatch, useDeleteJob } from '../hooks/useMatches';
import UploadZone from '../components/UploadZone';
import RankingList from '../components/RankingList';
import JdModal from '../components/JdModal';

// ─── Spinner ──────────────────────────────────────────────────────

function Spinner({ className = 'h-4 w-4 text-white' }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

// ─── Job match panel ──────────────────────────────────────────────

function JobMatchPanel({ jobId }: { jobId: string }) {
  const matches = useLatestMatches(jobId);
  const runMatch = useRunMatch(jobId);

  const hasResults =
    (runMatch.data?.candidates ?? matches.data?.candidates ?? []).length > 0;
  const results = runMatch.data ?? matches.data;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Top Candidates</h2>
          {results && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last run: {new Date(results.ranAt).toLocaleString()} · {results.modelUsed}
            </p>
          )}
        </div>
        <button
          data-testid="run-match"
          disabled={runMatch.isPending}
          onClick={() => runMatch.mutate()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 transition-colors"
        >
          {runMatch.isPending && <Spinner />}
          {runMatch.isPending ? 'Matching…' : 'Run Match'}
        </button>
      </div>

      {runMatch.isError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {(runMatch.error as Error).message}
        </div>
      )}

      {hasResults && results ? (
        <div className="overflow-y-auto flex-1">
          <RankingList candidates={results.candidates} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
          {runMatch.isPending ? (
            <p className="text-sm text-blue-500 animate-pulse">Finding the best candidates…</p>
          ) : matches.isLoading ? (
            <p className="text-sm text-gray-400">Loading results…</p>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-600">No results yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Click <strong>Run Match</strong> to generate the top-10 candidates.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Debounce hook ────────────────────────────────────────────────

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timer.current = setTimeout(() => setDebounced(value), delay);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, delay]);
  return debounced;
}

// ─── Main page ────────────────────────────────────────────────────

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
      onSuccess: () => {
        if (selectedJobId === id) setSelectedJobId(null);
      },
    });
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Upload JD
        </button>
      </div>

      {/* Upload zone */}
      {showUpload && (
        <div className="mb-5">
          <UploadZone hook={uploadHook} label="Upload job description (PDF or DOCX)" />
          {uploadHook.state.stage === 'done' && (
            <button
              onClick={() => { uploadHook.reset(); setShowUpload(false); }}
              className="mt-2 text-xs text-gray-400 hover:text-gray-600"
            >
              Close upload
            </button>
          )}
        </div>
      )}

      {jobs.isLoading && (
        <p className="text-sm text-gray-400 py-8 text-center">Loading jobs…</p>
      )}

      {!jobs.isLoading && jobList.length === 0 && !search && (
        <div className="text-center py-16">
          <p className="text-sm text-gray-500">No job descriptions yet.</p>
          <button
            onClick={() => setShowUpload(true)}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Upload your first JD →
          </button>
        </div>
      )}

      {/* Two-panel layout (shown when there are jobs OR when actively searching) */}
      {(jobList.length > 0 || search) && (
        <div className="flex gap-5 items-start">
          {/* Left sidebar */}
          <div className="w-64 shrink-0 sticky top-4 flex flex-col gap-2">
            {/* Search */}
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search jobs…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Job cards */}
            <div className="space-y-1.5">
              {jobList.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">No jobs found.</p>
              )}
              {jobList.map((j) => {
                const active = effectiveSelected === j.id;
                return (
                  <div
                    key={j.id}
                    className={`rounded-xl border transition-all ${
                      active
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {/* Clickable title area */}
                    <button
                      onClick={() => setSelectedJobId(j.id)}
                      className="w-full text-left px-4 pt-3 pb-1"
                    >
                      <p className={`text-sm font-medium leading-tight ${active ? 'text-blue-700' : 'text-gray-800'}`}>
                        {j.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(j.createdAt).toLocaleDateString()}
                      </p>
                    </button>

                    {/* Action row */}
                    <div className="flex items-center gap-1 px-3 pb-2.5 pt-1">
                      <button
                        onClick={() => setJdModalJobId(j.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View JD
                      </button>
                      <button
                        onClick={() => handleDelete(j.id, j.title)}
                        disabled={deleteJob.isPending}
                        className="ml-auto p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40"
                        aria-label="Delete job"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  aria-label="Previous page"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-xs text-gray-400">{page} / {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  aria-label="Next page"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl p-5 min-h-[480px]">
            {effectiveSelected ? (
              <JobMatchPanel jobId={effectiveSelected} />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-gray-400">
                Select a job to see matches
              </div>
            )}
          </div>
        </div>
      )}

      {/* JD View/Edit modal */}
      {jdModalJobId && (
        <JdModal jobId={jdModalJobId} onClose={() => setJdModalJobId(null)} />
      )}
    </div>
  );
}
