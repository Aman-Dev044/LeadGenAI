export interface UploadOptions {
  bucket: string;
  key: string;
  body: Buffer | ReadableStream;
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read';
}

export interface DownloadResult {
  body: Buffer;
  contentType: string;
  contentLength: number;
}

export interface IStorageProvider {
  upload(options: UploadOptions): Promise<{ url: string; key: string }>;
  download(bucket: string, key: string): Promise<DownloadResult>;
  delete(bucket: string, key: string): Promise<void>;
  getSignedUrl(bucket: string, key: string, expiresIn?: number): Promise<string>;
}
