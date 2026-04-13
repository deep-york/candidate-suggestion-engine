import { useState } from 'react';
import { useCandidate, useUpdateCandidate } from '../hooks/useCandidates';
import type { CandidateProfile } from '../lib/api-client';

interface CandidateModalProps {
  candidateId: string;
  onClose: () => void;
}

// ── Shell ─────────────────────────────────────────────────────────
function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="anim-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(10px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="anim-fade-up"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Tag({ label, variant = 'accent' }: { label: string; variant?: 'accent' | 'muted' | 'green' }) {
  const cls = variant === 'accent' ? 'cse-tag' : variant === 'green' ? 'cse-tag-green' : 'cse-tag-muted';
  return <span className={cls}>{label}</span>;
}

function SectionRow({ children }: { children: string }) {
  return (
    <div
      className="cse-label"
      style={{ marginBottom: 10, paddingBottom: 7, borderBottom: '1px solid var(--border)' }}
    >
      {children}
    </div>
  );
}

// ── View mode ─────────────────────────────────────────────────────
function CandidateView({
  fullName, email, profile, onEdit, onClose,
}: {
  fullName: string | null;
  email: string | null;
  profile: CandidateProfile;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '24px 28px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <div>
          <h2
            className="font-display"
            style={{ fontSize: 30, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.02em', lineHeight: 1.1 }}
          >
            {fullName ?? 'Unknown Candidate'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
            {profile.currentTitle && (
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{profile.currentTitle}</span>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                className="font-mono"
                style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: '0.04em', textDecoration: 'none' }}
              >
                {email}
              </a>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button onClick={onEdit} className="cse-btn">Edit</button>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: '1px solid var(--border-strong)',
              cursor: 'pointer',
              color: 'var(--text-2)',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-1)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-2)')}
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* Meta */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {profile.seniorityLevel && <Tag label={profile.seniorityLevel.toUpperCase()} variant="green" />}
          {profile.totalYearsExperience !== undefined && (
            <Tag label={`${profile.totalYearsExperience} YRS`} variant="muted" />
          )}
          {profile.languages?.map((l) => <Tag key={l} label={l.toUpperCase()} variant="muted" />)}
        </div>

        {profile.summary && (
          <div>
            <SectionRow>Summary</SectionRow>
            <p style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.75 }}>{profile.summary}</p>
          </div>
        )}

        {profile.skills?.length > 0 && (
          <div>
            <SectionRow>Skills</SectionRow>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {profile.skills.map((s) => <Tag key={s.name} label={s.name} variant="accent" />)}
            </div>
          </div>
        )}

        {profile.workExperience?.length > 0 && (
          <div>
            <SectionRow>Experience</SectionRow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {profile.workExperience.map((w, i) => (
                <div key={i} style={{ paddingLeft: 12, borderLeft: '1px solid var(--border-strong)' }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>{w.title}</p>
                  <p className="font-mono" style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 2, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {w.company} · {w.startDate}{w.endDate ? ` – ${w.endDate}` : ' – Present'}
                  </p>
                  {w.description && (
                    <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.65 }}>{w.description}</p>
                  )}
                  {w.technologies?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 7 }}>
                      {w.technologies.map((t) => <Tag key={t} label={t} variant="muted" />)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.education?.length > 0 && (
          <div>
            <SectionRow>Education</SectionRow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {profile.education.map((e, i) => (
                <div key={i}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{e.degree} in {e.field}</p>
                  <p className="font-mono" style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 2, letterSpacing: '0.04em' }}>
                    {e.institution}{e.graduationYear ? ` · ${e.graduationYear}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.certifications?.length > 0 && (
          <div>
            <SectionRow>Certifications</SectionRow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {profile.certifications.map((cert, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--text-1)' }}>
                  <span style={{ color: 'var(--accent)', marginTop: 4, fontSize: 7, flexShrink: 0 }}>◆</span>
                  <span>{cert}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Edit mode ─────────────────────────────────────────────────────
function CandidateEdit({
  candidateId,
  fullName: initialFullName,
  email: initialEmail,
  profile,
  onSaved,
  onCancel,
}: {
  candidateId: string;
  fullName: string | null;
  email: string | null;
  profile: CandidateProfile;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const update = useUpdateCandidate(candidateId);
  const [fullName, setFullName] = useState(initialFullName ?? '');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [currentTitle, setCurrentTitle] = useState(profile.currentTitle ?? '');
  const [totalYears, setTotalYears] = useState(String(profile.totalYearsExperience ?? 0));
  const [summary, setSummary] = useState(profile.summary ?? '');
  const [skills, setSkills] = useState((profile.skills ?? []).map((s) => s.name).join(', '));
  const [certifications, setCertifications] = useState((profile.certifications ?? []).join('\n'));

  function handleSave() {
    const parsedSkills = skills
      .split(',').map((s) => s.trim()).filter(Boolean)
      .map((name) => ({
        name,
        category: profile.skills.find((s) => s.name.toLowerCase() === name.toLowerCase())?.category ?? 'technical',
        proficiency: profile.skills.find((s) => s.name.toLowerCase() === name.toLowerCase())?.proficiency,
      }));
    const updatedProfile: Partial<CandidateProfile> = {
      ...profile,
      fullName: fullName.trim(),
      email: email.trim() || undefined,
      currentTitle: currentTitle.trim() || undefined,
      totalYearsExperience: Number(totalYears) || 0,
      summary: summary.trim(),
      skills: parsedSkills,
      certifications: certifications.split('\n').map((c) => c.trim()).filter(Boolean),
    };
    update.mutate(
      { fullName: fullName.trim(), email: email.trim() || undefined, profile: updatedProfile },
      { onSuccess: onSaved },
    );
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 28px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <span className="cse-label">Edit Candidate Profile</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onCancel} className="cse-btn">Cancel</button>
          <button
            disabled={update.isPending || !fullName.trim()}
            onClick={handleSave}
            className="cse-btn-primary"
          >
            {update.isPending ? 'Saving…' : 'Save & Re-embed'}
          </button>
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {update.isError && (
          <div style={{ padding: '10px 14px', background: 'var(--red-dim)', border: '1px solid var(--red)', fontSize: 12, color: 'var(--red)' }}>
            {(update.error as Error).message}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div className="cse-label" style={{ marginBottom: 6 }}>Full Name</div>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="cse-input" placeholder="Jane Smith" />
          </div>
          <div>
            <div className="cse-label" style={{ marginBottom: 6 }}>Email</div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="cse-input" placeholder="jane@example.com" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div className="cse-label" style={{ marginBottom: 6 }}>Current Title</div>
            <input value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)} className="cse-input" placeholder="Senior Software Engineer" />
          </div>
          <div>
            <div className="cse-label" style={{ marginBottom: 6 }}>Years Experience</div>
            <input type="number" min="0" max="50" value={totalYears} onChange={(e) => setTotalYears(e.target.value)} className="cse-input" />
          </div>
        </div>

        <div>
          <div className="cse-label" style={{ marginBottom: 6 }}>Summary</div>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} className="cse-textarea" placeholder="Brief professional summary…" />
        </div>

        <div>
          <div className="cse-label" style={{ marginBottom: 6 }}>
            Skills <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 300 }}>— comma-separated</span>
          </div>
          <input value={skills} onChange={(e) => setSkills(e.target.value)} className="cse-input" placeholder="React, TypeScript, Node.js, PostgreSQL" />
        </div>

        <div>
          <div className="cse-label" style={{ marginBottom: 6 }}>
            Certifications <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 300 }}>— one per line</span>
          </div>
          <textarea value={certifications} onChange={(e) => setCertifications(e.target.value)} rows={3} className="cse-textarea" placeholder="AWS Solutions Architect" />
        </div>

        <p
          className="font-mono"
          style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          Saving will regenerate the embedding vector from the updated profile.
        </p>
      </div>
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────
export default function CandidateModal({ candidateId, onClose }: CandidateModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { data, isLoading, isError } = useCandidate(candidateId);

  return (
    <ModalShell onClose={onClose}>
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}>
          <p className="font-mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Loading…</p>
        </div>
      )}
      {isError && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}>
          <p className="font-mono" style={{ fontSize: 10, color: 'var(--red)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Failed to load candidate.</p>
        </div>
      )}
      {data && !isEditing && (
        <CandidateView
          fullName={data.fullName}
          email={data.email}
          profile={data.profile}
          onEdit={() => setIsEditing(true)}
          onClose={onClose}
        />
      )}
      {data && isEditing && (
        <CandidateEdit
          candidateId={candidateId}
          fullName={data.fullName}
          email={data.email}
          profile={data.profile}
          onSaved={() => setIsEditing(false)}
          onCancel={() => setIsEditing(false)}
        />
      )}
    </ModalShell>
  );
}
