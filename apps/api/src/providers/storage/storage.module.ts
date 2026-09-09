import { Global, Module } from '@nestjs/common';
import { S3Provider } from './s3.provider';

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

@Global()
@Module({
  providers: [
    S3Provider,
    {
      provide: STORAGE_PROVIDER,
      useExisting: S3Provider,
    },
  ],
  exports: [STORAGE_PROVIDER, S3Provider],
})
export class StorageModule {}
