import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CredentialsService } from './credentials.service';
import { CredentialTesterService } from './credential-tester.service';
import { CredentialsController } from './credentials.controller';
import { TenantCredentialSchema } from '../../schemas/tenant-credential.schema';

/**
 * Global so any provider (AI, email, storage, prospecting) can resolve a
 * tenant's own keys without every feature module importing this one.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'TenantCredential', schema: TenantCredentialSchema }]),
  ],
  controllers: [CredentialsController],
  providers: [CredentialsService, CredentialTesterService],
  exports: [CredentialsService],
})
export class CredentialsModule {}
