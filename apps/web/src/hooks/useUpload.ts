import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export type UploadState =
  | { stage: 'idle' }
  | { stage: 'uploading' }
  | { stage: 'processing'; documentId: string; status: string }
  | { stage: 'done'; documentId: string }
  | { stage: 'error'; message: string };

export function useUpload(type: 'resume' | 'jd') {
  const [state, setState] = useState<UploadState>({ stage: 'idle' });
  const qc = useQueryClient();

  const upload = useCallback(
    async (file: File) => {
      setState({ stage: 'uploading' });
      try {
        const { documentId } = await apiClient.uploadFile(file, type);
        setState({ stage: 'processing', documentId, status: 'queued' });

        // Poll until ready or failed
        const poll = async () => {
          const { status, error } = await apiClient.getUploadStatus(documentId);
          if (status === 'ready') {
            setState({ stage: 'done', documentId });
            qc.invalidateQueries({ queryKey: ['candidates'] });
            qc.invalidateQueries({ queryKey: ['jobs'] });
          } else if (status === 'failed') {
            setState({ stage: 'error', message: error ?? 'Processing failed' });
          } else {
            setState({ stage: 'processing', documentId, status });
            setTimeout(poll, 2_000);
          }
        };
        setTimeout(poll, 1_500);
      } catch (err) {
        setState({
          stage: 'error',
          message: err instanceof Error ? err.message : 'Upload failed',
        });
      }
    },
    [type, qc],
  );

  const reset = () => setState({ stage: 'idle' });

  return { state, upload, reset };
}
