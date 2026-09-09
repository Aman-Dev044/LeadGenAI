import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  IStorageProvider,
  UploadOptions,
  DownloadResult,
} from '../../common/interfaces';

@Injectable()
export class S3Provider implements IStorageProvider {
  private readonly client: S3Client;
  private readonly logger = new Logger(S3Provider.name);

  constructor(private readonly configService: ConfigService) {
    this.client = new S3Client({
      region: this.configService.get<string>('storage.s3.region') || 'us-east-1',
      endpoint: this.configService.get<string>('storage.s3.endpoint'),
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.configService.get<string>('storage.s3.accessKeyId') || '',
        secretAccessKey: this.configService.get<string>('storage.s3.secretAccessKey') || '',
      },
    });
  }

  async upload(options: UploadOptions): Promise<{ url: string; key: string }> {
    const command = new PutObjectCommand({
      Bucket: options.bucket,
      Key: options.key,
      Body: options.body as any,
      ContentType: options.contentType,
      Metadata: options.metadata,
      ACL: options.acl,
    });

    await this.client.send(command);

    const endpoint = this.configService.get<string>('storage.s3.endpoint');
    const url = endpoint
      ? `${endpoint}/${options.bucket}/${options.key}`
      : `https://${options.bucket}.s3.amazonaws.com/${options.key}`;

    return { url, key: options.key };
  }

  async download(bucket: string, key: string): Promise<DownloadResult> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await this.client.send(command);

    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(Buffer.from(chunk));
    }

    return {
      body: Buffer.concat(chunks),
      contentType: response.ContentType || 'application/octet-stream',
      contentLength: response.ContentLength || 0,
    };
  }

  async delete(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
    await this.client.send(command);
  }

  async getSignedUrl(bucket: string, key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}
