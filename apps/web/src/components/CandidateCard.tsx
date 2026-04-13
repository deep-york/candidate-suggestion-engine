import type { CandidateListItem } from '../lib/api-client';

interface CandidateCardProps {
  candidate: CandidateListItem;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}

export default function CandidateCard({ candidate, onView, onDelete, isDeleting }: CandidateCardProps) {
  const profile = candidate.profile as {
    currentTitle?: string;
    totalYearsExperience?: number;
    skills?: Array<{ name: string }>;
  };

  const skillNames = (profile.skills ?? []).slice(0, 5).map((s) => s.name);

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
      data-testid="candidate-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">
            {candidate.fullName ?? 'Unknown'}
          </p>
          {profile.currentTitle && (
            <p className="text-sm text-gray-500 truncate">{profile.currentTitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {profile.totalYearsExperience !== undefined && (
            <span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5 whitespace-nowrap">
              {profile.totalYearsExperience} yrs
            </span>
          )}
          <button
            onClick={() => onView(candidate.id)}
            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            aria-label="View candidate"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Delete "${candidate.fullName ?? 'this candidate'}"?`)) {
                onDelete(candidate.id);
              }
            }}
            disabled={isDeleting}
            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40"
            aria-label="Delete candidate"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {skillNames.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {skillNames.map((skill) => (
            <span
              key={skill}
              className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5"
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
