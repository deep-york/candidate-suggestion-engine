import { useEffect, useRef, useState } from 'react';
import { useCandidates, useDeleteCandidate } from '../hooks/useCandidates';
import { useUpload } from '../hooks/useUpload';
import UploadZone from '../components/UploadZone';
import CandidateCard from '../components/CandidateCard';
import CandidateModal from '../components/CandidateModal';

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timer.current = setTimeout(() => setDebounced(value), delay);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, delay]);
  return debounced;
}

export default function Candidates() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [modalCandidateId, setModalCandidateId] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search);
  const { data, isLoading } = useCandidates(page, debouncedSearch);
  const uploadHook = useUpload('resume');
  const deleteCandidate = useDeleteCandidate();

  const total = data?.total ?? 0;
  const limit = data?.limit ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      <div className="anim-fade-up">
        {/* Page header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 36,
            paddingBottom: 20,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <h1
              className="font-display"
              style={{ fontSize: 42, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.025em', lineHeight: 1.1 }}
            >
              Candidates
            </h1>
            {!isLoading && (
              <p
                className="font-mono"
                style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 6, letterSpacing: '0.14em', textTransform: 'uppercase' }}
              >
                {total === 0
                  ? 'No profiles indexed'
                  : `${total} profile${total !== 1 ? 's' : ''} indexed`}
                {search && ` · matching "${debouncedSearch}"`}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <svg
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 11,
                  height: 11,
                  color: 'var(--text-2)',
                  pointerEvents: 'none',
                }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search profiles…"
                className="cse-input"
                style={{ paddingLeft: 28, width: 200, fontSize: 12 }}
              />
            </div>
            <button
              onClick={() => setShowUpload((v) => !v)}
              className="cse-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Upload
            </button>
          </div>
        </div>

        {/* Upload zone */}
        {showUpload && (
          <div className="anim-fade-up" style={{ marginBottom: 28 }}>
            <UploadZone hook={uploadHook} label="Upload resume" />
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

        {/* Loading */}
        {isLoading && (
          <p className="font-mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Loading…
          </p>
        )}

        {/* Empty state */}
        {!isLoading && total === 0 && !search && (
          <div style={{ padding: '72px 0', textAlign: 'center' }}>
            <div
              className="font-display"
              style={{ fontSize: 64, fontWeight: 300, lineHeight: 1, color: 'var(--text-3)', marginBottom: 16 }}
            >
              —
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>No candidates indexed yet.</p>
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
              Upload a resume →
            </button>
          </div>
        )}

        {/* Candidate list */}
        {data?.data && data.data.length > 0 && (
          <div>
            {/* Column header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 0 10px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span className="cse-label" style={{ flex: 1 }}>Candidate</span>
              <span className="cse-label" style={{ width: 48, textAlign: 'right', marginRight: 70 }}>Exp</span>
            </div>

            {data.data.map((c, i) => (
              <div key={c.id} className={`anim-fade-up d-${Math.min(i + 1, 10)}`}>
                <CandidateCard
                  candidate={c}
                  onView={(id) => setModalCandidateId(id)}
                  onDelete={(id) => deleteCandidate.mutate(id)}
                  isDeleting={deleteCandidate.isPending && deleteCandidate.variables === c.id}
                />
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              marginTop: 28,
            }}
          >
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="cse-btn"
              style={{ padding: '6px 14px' }}
            >
              ←
            </button>
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.1em' }}>
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="cse-btn"
              style={{ padding: '6px 14px' }}
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalCandidateId && (
        <CandidateModal
          candidateId={modalCandidateId}
          onClose={() => setModalCandidateId(null)}
        />
      )}
    </>
  );
}

