import { useState } from 'react';
import { useCandidate, useUpdateCandidate } from '../hooks/useCandidates';
import type { CandidateProfile } from '../lib/api-client';

interface CandidateModalProps {
  candidateId: string;
  onClose: () => void;
}

// ─── Shared ───────────────────────────────────────────────────────

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {children}
      </div>
    </div>
  );
}

function Chip({ label, colour = 'blue' }: { label: string; colour?: 'blue' | 'gray' | 'green' }) {
  const cls = {
    blue: 'bg-blue-50 text-blue-700',
    gray: 'bg-gray-100 text-gray-600',
    green: 'bg-green-50 text-green-700',
  }[colour];
  return <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${cls}`}>{label}</span>;
}

// ─── View mode ────────────────────────────────────────────────────

function CandidateView({
  fullName,
  email,
  profile,
  onEdit,
  onClose,
}: {
  fullName: string | null;
  email: string | null;
  profile: CandidateProfile;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">
            {fullName ?? 'Unknown Candidate'}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {profile.currentTitle && (
              <span className="text-sm text-gray-500">{profile.currentTitle}</span>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                className="text-sm text-blue-600 hover:underline truncate"
              >
                {email}
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onEdit}
            className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
        {/* Meta chips */}
        <div className="flex flex-wrap gap-2">
          {profile.seniorityLevel && <Chip label={profile.seniorityLevel} colour="green" />}
          {profile.totalYearsExperience !== undefined && (
            <Chip label={`${profile.totalYearsExperience} yrs experience`} colour="gray" />
          )}
          {profile.languages?.map((l) => (
            <Chip key={l} label={l} colour="gray" />
          ))}
        </div>

        {/* Summary */}
        {profile.summary && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Summary</p>
            <p className="text-sm text-gray-700 leading-relaxed">{profile.summary}</p>
          </div>
        )}

        {/* Skills */}
        {profile.skills?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map((s) => (
                <Chip key={s.name} label={s.name} colour="blue" />
              ))}
            </div>
          </div>
        )}

        {/* Work experience */}
        {profile.workExperience?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Experience
            </p>
            <div className="space-y-3">
              {profile.workExperience.map((w, i) => (
                <div key={i} className="pl-3 border-l-2 border-gray-200">
                  <p className="text-sm font-semibold text-gray-900">{w.title}</p>
                  <p className="text-sm text-gray-500">
                    {w.company} · {w.startDate}
                    {w.endDate ? ` – ${w.endDate}` : ' – Present'}
                  </p>
                  {w.description && (
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">{w.description}</p>
                  )}
                  {w.technologies?.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {w.technologies.map((t) => (
                        <span key={t} className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {profile.education?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Education
            </p>
            <div className="space-y-1.5">
              {profile.education.map((e, i) => (
                <div key={i}>
                  <p className="text-sm font-medium text-gray-800">
                    {e.degree} in {e.field}
                  </p>
                  <p className="text-sm text-gray-500">
                    {e.institution}
                    {e.graduationYear ? ` · ${e.graduationYear}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {profile.certifications?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Certifications
            </p>
            <ul className="space-y-0.5">
              {profile.certifications.map((cert, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-2 items-start">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  {cert}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Edit mode ────────────────────────────────────────────────────

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
  const [skills, setSkills] = useState(
    (profile.skills ?? []).map((s) => s.name).join(', '),
  );
  const [certifications, setCertifications] = useState(
    (profile.certifications ?? []).join('\n'),
  );

  function handleSave() {
    const parsedSkills = skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({
        name,
        // Preserve existing category/proficiency if skill name matches, else default
        category: profile.skills.find(
          (s) => s.name.toLowerCase() === name.toLowerCase(),
        )?.category ?? 'technical',
        proficiency: profile.skills.find(
          (s) => s.name.toLowerCase() === name.toLowerCase(),
        )?.proficiency,
      }));

    const updatedProfile: Partial<CandidateProfile> = {
      ...profile,
      fullName: fullName.trim(),
      email: email.trim() || undefined,
      currentTitle: currentTitle.trim() || undefined,
      totalYearsExperience: Number(totalYears) || 0,
      summary: summary.trim(),
      skills: parsedSkills,
      certifications: certifications
        .split('\n')
        .map((c) => c.trim())
        .filter(Boolean),
    };

    update.mutate(
      { fullName: fullName.trim(), email: email.trim() || undefined, profile: updatedProfile },
      { onSuccess: onSaved },
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Edit Candidate</h2>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={update.isPending || !fullName.trim()}
            onClick={handleSave}
            className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {update.isPending ? 'Saving…' : 'Save & Re-embed'}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
        {update.isError && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {(update.error as Error).message}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Full Name
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Jane Smith"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="jane@example.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Current Title
            </label>
            <input
              value={currentTitle}
              onChange={(e) => setCurrentTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Senior Software Engineer"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Years of Experience
            </label>
            <input
              type="number"
              min="0"
              max="50"
              value={totalYears}
              onChange={(e) => setTotalYears(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Summary
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Brief professional summary…"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Skills <span className="font-normal text-gray-400">(comma-separated)</span>
          </label>
          <input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="React, TypeScript, Node.js, PostgreSQL"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Certifications <span className="font-normal text-gray-400">(one per line)</span>
          </label>
          <textarea
            value={certifications}
            onChange={(e) => setCertifications(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="AWS Solutions Architect&#10;Google Cloud Professional"
          />
        </div>

        <p className="text-xs text-gray-400">
          Saving will regenerate the candidate's embedding vector using the updated profile.
          They will appear in future match runs with their new vector.
        </p>
      </div>
    </>
  );
}

// ─── Root modal ───────────────────────────────────────────────────

export default function CandidateModal({ candidateId, onClose }: CandidateModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { data, isLoading, isError } = useCandidate(candidateId);

  return (
    <ModalOverlay onClose={onClose}>
      {isLoading && (
        <div className="flex items-center justify-center h-64 text-sm text-gray-400">
          Loading…
        </div>
      )}
      {isError && (
        <div className="flex items-center justify-center h-64 text-sm text-red-500">
          Failed to load candidate.
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
    </ModalOverlay>
  );
}
