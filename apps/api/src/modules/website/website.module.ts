import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebsiteController } from './website.controller';
import { WebsiteService } from './website.service';
import { TenantSchema } from '../../schemas/tenant.schema';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';

/**
 * Global so the calling and WhatsApp agents can ask for the website briefing
 * without importing this module everywhere.
 */
@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: 'Tenant', schema: TenantSchema }]), KnowledgeBaseModule],
  controllers: [WebsiteController],
  providers: [WebsiteService],
  exports: [WebsiteService],
})
export class WebsiteModule {}
