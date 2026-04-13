import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type JobDescriptionProfile } from '../lib/api-client';

interface JdModalProps {
  jobId: string;
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

function Tag({ label, variant = 'accent' }: { label: string; variant?: 'accent' | 'muted' | 'amber' }) {
  const cls = variant === 'accent' ? 'cse-tag' : 'cse-tag-muted';
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

// ── View ──────────────────────────────────────────────────────────
function JdView({
  title, profile, onEdit, onClose,
}: {
  title: string;
  profile: JobDescriptionProfile;
  onEdit: () => void;
  onClose: () => void;
}) {
  const requiredSkills = profile.requiredSkills.filter((s) => s.required).map((s) => s.name);
  const niceToHave = [
    ...profile.requiredSkills.filter((s) => !s.required).map((s) => s.name),
    ...profile.preferredSkills,
  ];

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
            {title}
          </h2>
          {profile.department && (
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 5 }}>{profile.department}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
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
        {/* Meta chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {profile.seniority && <Tag label={profile.seniority.toUpperCase()} variant="amber" />}
          <Tag
            label={
              profile.maxYearsExperience
                ? `${profile.minYearsExperience}–${profile.maxYearsExperience} YRS`
                : `${profile.minYearsExperience}+ YRS`
            }
            variant="muted"
          />
          {profile.industry && <Tag label={profile.industry.toUpperCase()} variant="muted" />}
          {profile.educationRequirement && <Tag label={profile.educationRequirement} variant="muted" />}
        </div>

        {profile.summary && (
          <div>
            <SectionRow>Summary</SectionRow>
            <p style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.75 }}>{profile.summary}</p>
          </div>
        )}

        {requiredSkills.length > 0 && (
          <div>
            <SectionRow>Required Skills</SectionRow>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {requiredSkills.map((s) => <Tag key={s} label={s} variant="accent" />)}
            </div>
          </div>
        )}

        {niceToHave.length > 0 && (
          <div>
            <SectionRow>Nice to Have</SectionRow>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {niceToHave.map((s) => <Tag key={s} label={s} variant="muted" />)}
            </div>
          </div>
        )}

        {profile.responsibilities.length > 0 && (
          <div>
            <SectionRow>Responsibilities</SectionRow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {profile.responsibilities.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text-1)' }}>
                  <span style={{ color: 'var(--accent)', fontSize: 7, marginTop: 5, flexShrink: 0 }}>◆</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Edit ──────────────────────────────────────────────────────────
function JdEdit({
  jobId, title: initialTitle, profile, onSaved, onCancel,
}: {
  jobId: string;
  title: string;
  profile: JobDescriptionProfile;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(profile.summary);
  const [requiredSkills, setRequiredSkills] = useState(
    profile.requiredSkills.filter((s) => s.required).map((s) => s.name).join(', '),
  );
  const [preferredSkills, setPreferredSkills] = useState(
    [
      ...profile.requiredSkills.filter((s) => !s.required).map((s) => s.name),
      ...profile.preferredSkills,
    ].join(', '),
  );
  const [responsibilities, setResponsibilities] = useState(profile.responsibilities.join('\n'));

  const save = useMutation({
    mutationFn: () => {
      const reqSkills = requiredSkills
        .split(',').map((s) => s.trim()).filter(Boolean)
        .map((n) => ({ name: n, required: true }));
      const prefSkills = preferredSkills.split(',').map((s) => s.trim()).filter(Boolean);
      const updatedProfile: Partial<JobDescriptionProfile> = {
        ...profile,
        summary,
        requiredSkills: reqSkills,
        preferredSkills: prefSkills,
        responsibilities: responsibilities.split('\n').map((r) => r.trim()).filter(Boolean),
      };
      return apiClient.updateJob(jobId, { title: title.trim(), profile: updatedProfile });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['job', jobId] });
      onSaved();
    },
  });

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
        <span className="cse-label">Edit Job Description</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onCancel} className="cse-btn">Cancel</button>
          <button
            disabled={save.isPending || !title.trim()}
            onClick={() => save.mutate()}
            className="cse-btn-primary"
          >
            {save.isPending ? 'Saving…' : 'Save & Re-embed'}
          </button>
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {save.isError && (
          <div style={{ padding: '10px 14px', background: 'var(--red-dim)', border: '1px solid var(--red)', fontSize: 12, color: 'var(--red)' }}>
            {(save.error as Error).message}
          </div>
        )}

        <div>
          <div className="cse-label" style={{ marginBottom: 6 }}>Job Title</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="cse-input" placeholder="Senior Software Engineer" />
        </div>

        <div>
          <div className="cse-label" style={{ marginBottom: 6 }}>Summary</div>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} className="cse-textarea" placeholder="Role description…" />
        </div>

        <div>
          <div className="cse-label" style={{ marginBottom: 6 }}>
            Required Skills <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 300 }}>— comma-separated</span>
          </div>
          <input value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)} className="cse-input" placeholder="React, TypeScript, Node.js" />
        </div>

        <div>
          <div className="cse-label" style={{ marginBottom: 6 }}>
            Nice-to-Have <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 300 }}>— comma-separated</span>
          </div>
          <input value={preferredSkills} onChange={(e) => setPreferredSkills(e.target.value)} className="cse-input" placeholder="GraphQL, Docker, AWS" />
        </div>

        <div>
          <div className="cse-label" style={{ marginBottom: 6 }}>
            Responsibilities <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 300 }}>— one per line</span>
          </div>
          <textarea value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} rows={6} className="cse-textarea" placeholder="Design and implement features" />
        </div>

        <p
          className="font-mono"
          style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          Saving clears the stored embedding. Vector regenerates on next match run.
        </p>
      </div>
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────
export default function JdModal({ jobId, onClose }: JdModalProps) {
  const [isEditing, setIsEditing] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => apiClient.getJob(jobId),
  });

  return (
    <ModalShell onClose={onClose}>
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}>
          <p className="font-mono" style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Loading…</p>
        </div>
      )}
      {isError && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220 }}>
          <p className="font-mono" style={{ fontSize: 10, color: 'var(--red)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Failed to load job description.</p>
        </div>
      )}
      {data && !isEditing && (
        <JdView title={data.title} profile={data.profile} onEdit={() => setIsEditing(true)} onClose={onClose} />
      )}
      {data && isEditing && (
        <JdEdit
          jobId={jobId}
          title={data.title}
          profile={data.profile}
          onSaved={() => setIsEditing(false)}
          onCancel={() => setIsEditing(false)}
        />
      )}
    </ModalShell>
  );
}
