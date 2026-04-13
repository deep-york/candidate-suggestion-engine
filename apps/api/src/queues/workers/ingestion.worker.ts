import { Worker } from 'bullmq';
import { getBullMQConnection } from '../../lib/bullmq-connection.js';
import { runIngestPipeline } from '../../services/pipeline/ingest.pipeline.js';
import type { IngestionJobData } from '../ingestion.queue.js';

export function startIngestionWorker(): Worker<IngestionJobData> {
  const worker = new Worker<IngestionJobData>(
    'ingestion',
    async (job) => {
      console.log(`[Worker] Processing ingestion job ${job.id} — documentId: ${job.data.documentId}`);
      await runIngestPipeline(job.data.documentId);
      console.log(`[Worker] Completed ingestion job ${job.id}`);
    },
    {
      connection: getBullMQConnection(),
      concurrency: 3, // process up to 3 documents simultaneously
    },
  );

  worker.on('failed', (job, err) => {
    console.error(
      `[Worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts.attempts}):`,
      err.message,
    );
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
  });

  return worker;
}
