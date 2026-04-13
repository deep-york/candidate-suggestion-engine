import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export default function Dashboard() {
  const candidates = useQuery({
    queryKey: ['candidates', 1],
    queryFn: () => apiClient.listCandidates(1),
  });
  const jobs = useQuery({
    queryKey: ['jobs'],
    queryFn: () => apiClient.listJobs(),
  });

  const stats = [
    { label: 'Total Candidates', value: candidates.data?.data.length ?? '—' },
    { label: 'Job Descriptions', value: jobs.data?.data.length ?? '—' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white border border-gray-200 rounded-lg p-6"
          >
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Recent Jobs
        </h2>
        {jobs.isLoading && (
          <p className="text-sm text-gray-400">Loading…</p>
        )}
        {jobs.data?.data.length === 0 && (
          <p className="text-sm text-gray-400">
            No jobs yet. Upload a job description on the Jobs page.
          </p>
        )}
        <ul className="space-y-2">
          {jobs.data?.data.slice(0, 5).map((j) => (
            <li key={j.id} className="text-sm text-gray-700">
              {j.title}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
