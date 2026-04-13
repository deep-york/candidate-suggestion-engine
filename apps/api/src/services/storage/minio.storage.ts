import { Client as MinioClient } from 'minio';
import { randomUUID } from 'crypto';
import type { IStorageService } from './index.js';
import { env } from '../../lib/env.js';

const client = new MinioClient({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
});

async function ensureBucket(bucket: string): Promise<void> {
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket);
  }
}

export class MinioStorageService implements IStorageService {
  private readonly bucket = env.MINIO_BUCKET;

  async put(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await ensureBucket(this.bucket);
    await client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
  }

  async get(key: string): Promise<Buffer> {
    const stream = await client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await client.removeObject(this.bucket, key);
  }

  buildKey(type: 'resume' | 'jd', ext: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${type}/${year}/${month}/${randomUUID()}.${ext}`;
  }
}

export const storageService = new MinioStorageService();
