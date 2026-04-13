import { Queue } from 'bullmq';
import { getBullMQConnection } from '../lib/bullmq-connection.js';

export interface IngestionJobData {
  documentId: string;
}

export const ingestionQueue = new Queue<IngestionJobData>('ingestion', {
  connection: getBullMQConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2_000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export async function enqueueIngestion(documentId: string): Promise<string> {
  const job = await ingestionQueue.add(
    'ingest',
    { documentId },
    { jobId: `ingest_${documentId}` },
  );
  return job.id!;
}
