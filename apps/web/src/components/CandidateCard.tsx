import type { CandidateListItem } from '../lib/api-client';

// Eye icon
function EyeIcon() {
  return (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

// Trash icon
function TrashIcon() {
  return (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

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
      data-testid="candidate-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '13px 0',
        borderBottom: '1px solid var(--border)',
        transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.015)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Name + title + skills */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>
            {candidate.fullName ?? 'Unknown'}
          </span>
          {profile.currentTitle && (
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{profile.currentTitle}</span>
          )}
        </div>
        {skillNames.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5 }}>
            {skillNames.map((s) => <span key={s} className="cse-tag">{s}</span>)}
          </div>
        )}
      </div>

      {/* Year badge */}
      {profile.totalYearsExperience !== undefined && (
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            color: 'var(--text-2)',
            background: 'rgba(255,255,255,0.04)',
            padding: '2px 8px',
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
          }}
        >
          {profile.totalYearsExperience} yrs
        </span>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
        <button
          onClick={() => onView(candidate.id)}
          aria-label="View candidate"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-2)',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-2)')}
        >
          <EyeIcon />
        </button>
        <button
          onClick={() => {
            if (window.confirm(`Delete "${candidate.fullName ?? 'this candidate'}"?`)) {
              onDelete(candidate.id);
            }
          }}
          disabled={isDeleting}
          aria-label="Delete candidate"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-2)',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            opacity: isDeleting ? 0.35 : 1,
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--red)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-2)')}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}
