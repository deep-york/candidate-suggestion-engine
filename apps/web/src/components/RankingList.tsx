import { useState } from 'react';
import type { RankedCandidate } from '../lib/api-client';

interface RankingListProps {
  candidates: RankedCandidate[];
}

// ── Score bar ─────────────────────────────────────────────────────
function ScoreBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? 'var(--green)' :
    pct >= 55 ? 'var(--accent)' :
    'var(--red)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {label && (
        <span
          className="font-mono"
          style={{ fontSize: 9, color: 'var(--text-2)', letterSpacing: '0.16em', textTransform: 'uppercase', width: 48, flexShrink: 0 }}
        >
          {label}
        </span>
      )}
      <div
        style={{
          flex: 1,
          height: 1,
          background: 'var(--border-strong)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          className="score-fill"
          style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: color }}
        />
      </div>
      <span
        className="font-mono"
        style={{ fontSize: 11, color, letterSpacing: '0.04em', width: 32, textAlign: 'right', flexShrink: 0 }}
      >
        {pct}%
      </span>
    </div>
  );
}

// ── Rank card ─────────────────────────────────────────────────────
function RankCard({ c, index }: { c: RankedCandidate; index: number }) {
  const [open, setOpen] = useState(false);
  const hasDetails = c.strengths.length > 0 || c.gaps.length > 0 || !!c.reasoning;

  const rankStr = String(c.rank).padStart(2, '0');

  // Color progression: amber for #1, then fades toward background
  const rankColor =
    c.rank === 1 ? 'var(--accent)' :
    c.rank === 2 ? 'rgba(201,150,74,0.45)' :
    c.rank === 3 ? 'rgba(201,150,74,0.28)' :
    'var(--text-3)';

  return (
    <li
      className={`anim-fade-up d-${Math.min(index + 1, 10)}`}
      style={{ borderBottom: '1px solid var(--border)' }}
      data-testid="candidate-rank-card"
    >
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 24,
          padding: '22px 0',
          cursor: hasDetails ? 'pointer' : 'default',
          background: 'none',
          border: 'none',
          width: '100%',
          textAlign: 'left',
        }}
        aria-expanded={open}
      >
        {/* Big editorial rank number */}
        <span
          className="font-display"
          style={{
            fontSize: 56,
            fontWeight: 300,
            lineHeight: 0.9,
            color: rankColor,
            width: 68,
            flexShrink: 0,
            letterSpacing: '-0.04em',
            marginTop: 2,
            userSelect: 'none',
          }}
        >
          {rankStr}
        </span>

        {/* Candidate info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-1)', lineHeight: 1.3 }}>
                {c.candidate.fullName ?? 'Candidate'}
              </p>
              {c.candidate.currentTitle && (
                <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.4 }}>
                  {c.candidate.currentTitle}
                  {c.candidate.totalYearsExperience !== undefined && (
                    <span style={{ color: 'var(--text-3)' }}> · {c.candidate.totalYearsExperience} yrs</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Score bar */}
          <div style={{ marginTop: 10, maxWidth: 300 }}>
            <ScoreBar value={c.matchScore} label="Match" />
          </div>

          {/* Skill tags */}
          {c.candidate.skills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 8 }}>
              {c.candidate.skills.slice(0, 6).map((s) => (
                <span key={s} className="cse-tag-muted">{s}</span>
              ))}
              {c.candidate.skills.length > 6 && (
                <span className="font-mono" style={{ fontSize: 9, color: 'var(--text-3)', padding: '2px 4px' }}>
                  +{c.candidate.skills.length - 6}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Chevron */}
        {hasDetails && (
          <svg
            style={{
              width: 12,
              height: 12,
              color: 'var(--text-3)',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
              flexShrink: 0,
              marginTop: 8,
            }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Expanded panel */}
      {open && hasDetails && (
        <div
          className="anim-fade-in"
          style={{
            padding: '16px 0 24px 92px',
            borderTop: '1px solid var(--border)',
          }}
        >
          {/* Vector similarity */}
          <div style={{ marginBottom: 16, maxWidth: 300 }}>
            <ScoreBar value={c.vectorSimilarity} label="Vector" />
          </div>

          {c.strengths.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div className="cse-label" style={{ marginBottom: 8 }}>Strengths</div>
              {c.strengths.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-1)', marginBottom: 4 }}>
                  <span style={{ color: 'var(--green)', fontWeight: 700, marginTop: 1, flexShrink: 0 }}>+</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}

          {c.gaps.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div className="cse-label" style={{ marginBottom: 8 }}>Gaps</div>
              {c.gaps.map((g, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-1)', marginBottom: 4 }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 700, marginTop: 1, flexShrink: 0 }}>−</span>
                  <span>{g}</span>
                </div>
              ))}
            </div>
          )}

          {c.reasoning && (
            <div>
              <div className="cse-label" style={{ marginBottom: 8 }}>Reasoning</div>
              <p style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.7 }}>{c.reasoning}</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function RankingList({ candidates }: RankingListProps) {
  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {candidates.map((c, i) => (
        <RankCard key={c.candidateId} c={c} index={i} />
      ))}
    </ol>
  );
}

