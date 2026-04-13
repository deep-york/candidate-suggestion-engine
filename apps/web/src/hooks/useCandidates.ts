import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, type CandidateProfile } from '../lib/api-client';

export function useCandidates(page = 1, search = '') {
  return useQuery({
    queryKey: ['candidates', page, search],
    queryFn: () => apiClient.listCandidates(page, search),
  });
}

export function useCandidate(id: string) {
  return useQuery({
    queryKey: ['candidate', id],
    queryFn: () => apiClient.getCandidate(id),
    enabled: !!id,
  });
}

export function useUpdateCandidate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fullName?: string; email?: string; profile?: Partial<CandidateProfile> }) =>
      apiClient.updateCandidate(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidates'] });
      qc.invalidateQueries({ queryKey: ['candidate', id] });
    },
  });
}

export function useDeleteCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteCandidate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidates'] });
    },
  });
}
