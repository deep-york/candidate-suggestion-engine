import { useState } from 'react';
import type { RankedCandidate } from '../lib/api-client';

interface RankingListProps {
  candidates: RankedCandidate[];
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ScoreBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const colour =
    pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <span
        className={`text-xs font-semibold tabular-nums ${
          pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-500'
        }`}
      >
        {pct}%
      </span>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colours: Record<number, string> = {
    1: 'bg-yellow-400 text-yellow-900',
    2: 'bg-gray-300 text-gray-700',
    3: 'bg-amber-600 text-white',
  };
  const cls = colours[rank] ?? 'bg-blue-600 text-white';
  return (
    <span
      className={`shrink-0 w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center ${cls}`}
      data-testid="rank"
    >
      {rank}
    </span>
  );
}

function RankCard({ c }: { c: RankedCandidate }) {
  const [open, setOpen] = useState(false);
  const hasDetails =
    c.strengths.length > 0 || c.gaps.length > 0 || !!c.reasoning;

  return (
    <li
      className="bg-white border border-gray-200 rounded-xl overflow-hidden transition-shadow hover:shadow-md"
      data-testid="candidate-rank-card"
    >
      {/* ── Summary row (always visible) ──────────────────────────── */}
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        className={`w-full text-left px-5 py-4 flex items-start gap-4 ${
          hasDetails ? 'cursor-pointer' : 'cursor-default'
        }`}
        aria-expanded={open}
      >
        <RankBadge rank={c.rank} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">
                {c.candidate.fullName ?? 'Candidate'}
              </p>
              {c.candidate.currentTitle && (
                <p className="text-sm text-gray-500 truncate">
                  {c.candidate.currentTitle}
                  {c.candidate.totalYearsExperience !== undefined && (
                    <span className="text-gray-400">
                      {' '}· {c.candidate.totalYearsExperience} yrs
                    </span>
                  )}
                </p>
              )}
            </div>
            <div className="text-right min-w-[72px]">
              <p className="text-xs font-medium text-gray-500">Match</p>
              <ScoreBar value={c.matchScore} />
            </div>
          </div>

          {/* Skills chips */}
          {c.candidate.skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {c.candidate.skills.slice(0, 6).map((s) => (
                <span
                  key={s}
                  className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5"
                >
                  {s}
                </span>
              ))}
              {c.candidate.skills.length > 6 && (
                <span className="text-xs text-gray-400">
                  +{c.candidate.skills.length - 6} more
                </span>
              )}
            </div>
          )}
        </div>

        {hasDetails && <ChevronIcon open={open} />}
      </button>

      {/* ── Expanded detail panel ─────────────────────────────────── */}
      {open && hasDetails && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
          {/* Vector similarity sub-bar */}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span className="whitespace-nowrap">Vector similarity</span>
            <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-300 rounded-full"
                style={{ width: `${Math.round(c.vectorSimilarity * 100)}%` }}
              />
            </div>
            <span className="tabular-nums">
              {(c.vectorSimilarity * 100).toFixed(0)}%
            </span>
          </div>

          {/* Strengths */}
          {c.strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">
                Strengths
              </p>
              <ul className="space-y-1">
                {c.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2 items-start">
                    <span className="mt-0.5 text-green-500 font-bold leading-none">+</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gaps */}
          {c.gaps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">
                Gaps
              </p>
              <ul className="space-y-1">
                {c.gaps.map((g, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2 items-start">
                    <span className="mt-0.5 text-amber-500 font-bold leading-none">−</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reasoning */}
          {c.reasoning && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Reasoning
              </p>
              <p className="text-sm text-gray-700 leading-relaxed">{c.reasoning}</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function RankingList({ candidates }: RankingListProps) {
  return (
    <ol className="space-y-3">
      {candidates.map((c) => (
        <RankCard key={c.candidateId} c={c} />
      ))}
    </ol>
  );
}
