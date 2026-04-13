import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export function useLatestMatches(jobId: string) {
  return useQuery({
    queryKey: ['matches', jobId],
    queryFn: () => apiClient.getLatestMatches(jobId),
    retry: false,
  });
}

export function useRunMatch(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.runMatch(jobId),
    onSuccess: (data) => {
      qc.setQueryData(['matches', jobId], data);
    },
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteJob(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
