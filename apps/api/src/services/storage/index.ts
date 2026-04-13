export interface IStorageService {
  put(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  buildKey(type: 'resume' | 'jd', ext: string): string;
}
