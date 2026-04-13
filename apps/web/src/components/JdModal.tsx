import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type JobDescriptionProfile } from '../lib/api-client';

interface JdModalProps {
  jobId: string;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────

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

function Chip({ label, colour = 'blue' }: { label: string; colour?: 'blue' | 'gray' | 'amber' }) {
  const cls = {
    blue: 'bg-blue-50 text-blue-700',
    gray: 'bg-gray-100 text-gray-600',
    amber: 'bg-amber-50 text-amber-700',
  }[colour];
  return (
    <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${cls}`}>{label}</span>
  );
}

// ─── View mode ────────────────────────────────────────────────────

function JdView({
  title,
  profile,
  onEdit,
  onClose,
}: {
  title: string;
  profile: JobDescriptionProfile;
  onEdit: () => void;
  onClose: () => void;
}) {
  const requiredSkills = profile.requiredSkills.filter((s) => s.required).map((s) => s.name);
  const niceToHave = profile.requiredSkills.filter((s) => !s.required).map((s) => s.name);

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{title}</h2>
          {profile.department && (
            <p className="text-sm text-gray-500 mt-0.5">{profile.department}</p>
          )}
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
        {/* Summary */}
        {profile.summary && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Summary</p>
            <p className="text-sm text-gray-700 leading-relaxed">{profile.summary}</p>
          </div>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap gap-3">
          {profile.seniority && <Chip label={profile.seniority} colour="amber" />}
          <Chip
            label={
              profile.maxYearsExperience
                ? `${profile.minYearsExperience}–${profile.maxYearsExperience} yrs exp`
                : `${profile.minYearsExperience}+ yrs exp`
            }
            colour="gray"
          />
          {profile.industry && <Chip label={profile.industry} colour="gray" />}
          {profile.educationRequirement && (
            <Chip label={profile.educationRequirement} colour="gray" />
          )}
        </div>

        {/* Required skills */}
        {requiredSkills.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Required Skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {requiredSkills.map((s) => (
                <Chip key={s} label={s} colour="blue" />
              ))}
            </div>
          </div>
        )}

        {/* Nice-to-have / preferred */}
        {(niceToHave.length > 0 || profile.preferredSkills.length > 0) && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Nice to Have
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[...niceToHave, ...profile.preferredSkills].map((s) => (
                <Chip key={s} label={s} colour="gray" />
              ))}
            </div>
          </div>
        )}

        {/* Responsibilities */}
        {profile.responsibilities.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Responsibilities
            </p>
            <ul className="space-y-1">
              {profile.responsibilities.map((r, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-2 items-start">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                  {r}
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

function JdEdit({
  jobId,
  title: initialTitle,
  profile,
  onSaved,
  onCancel,
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
  const [responsibilities, setResponsibilities] = useState(
    profile.responsibilities.join('\n'),
  );

  const save = useMutation({
    mutationFn: () => {
      const reqSkills = requiredSkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ name, required: true }));
      const prefSkills = preferredSkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const updatedProfile: Partial<JobDescriptionProfile> = {
        ...profile,
        summary,
        requiredSkills: reqSkills,
        preferredSkills: prefSkills,
        responsibilities: responsibilities
          .split('\n')
          .map((r) => r.trim())
          .filter(Boolean),
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
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Edit Job Description</h2>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={save.isPending || !title.trim()}
            onClick={() => save.mutate()}
            className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {save.isPending ? 'Saving…' : 'Save & Re-embed'}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
        {save.isError && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {(save.error as Error).message}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Job Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Senior Software Engineer"
          />
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
            placeholder="Brief description of the role…"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Required Skills <span className="font-normal text-gray-400">(comma-separated)</span>
          </label>
          <input
            value={requiredSkills}
            onChange={(e) => setRequiredSkills(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="React, TypeScript, Node.js"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Nice-to-Have Skills <span className="font-normal text-gray-400">(comma-separated)</span>
          </label>
          <input
            value={preferredSkills}
            onChange={(e) => setPreferredSkills(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="GraphQL, Docker, AWS"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Responsibilities <span className="font-normal text-gray-400">(one per line)</span>
          </label>
          <textarea
            value={responsibilities}
            onChange={(e) => setResponsibilities(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Design and implement backend services&#10;Review code and mentor junior engineers"
          />
        </div>

        <p className="text-xs text-gray-400">
          Saving will clear the stored embedding. The vector will be regenerated automatically on the next match run.
        </p>
      </div>
    </>
  );
}

// ─── Root modal ───────────────────────────────────────────────────

export default function JdModal({ jobId, onClose }: JdModalProps) {
  const [isEditing, setIsEditing] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => apiClient.getJob(jobId),
  });

  return (
    <ModalOverlay onClose={onClose}>
      {isLoading && (
        <div className="flex items-center justify-center h-64 text-sm text-gray-400">
          Loading…
        </div>
      )}
      {isError && (
        <div className="flex items-center justify-center h-64 text-sm text-red-500">
          Failed to load job description.
        </div>
      )}
      {data && !isEditing && (
        <JdView
          title={data.title}
          profile={data.profile}
          onEdit={() => setIsEditing(true)}
          onClose={onClose}
        />
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
    </ModalOverlay>
  );
}
