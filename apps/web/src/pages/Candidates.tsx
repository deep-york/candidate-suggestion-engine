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
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Candidates</h1>

      <div className="mb-6">
        <UploadZone hook={uploadHook} label="Upload resume" />
      </div>

      {/* Search */}
      <div className="relative mb-4">
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
          placeholder="Search by name or email…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* Result count */}
      {!isLoading && (
        <p className="text-xs text-gray-400 mb-3">
          {total === 0
            ? 'No candidates found'
            : `${total} candidate${total !== 1 ? 's' : ''}${search ? ` matching "${debouncedSearch}"` : ''}`}
        </p>
      )}

      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}

      <div className="grid gap-3">
        {data?.data.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            onView={(id) => setModalCandidateId(id)}
            onDelete={(id) => deleteCandidate.mutate(id)}
            isDeleting={deleteCandidate.isPending && deleteCandidate.variables === c.id}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>

    {/* Candidate view/edit modal */}
    {modalCandidateId && (
      <CandidateModal
        candidateId={modalCandidateId}
        onClose={() => setModalCandidateId(null)}
      />
    )}
  </>
  );
}
