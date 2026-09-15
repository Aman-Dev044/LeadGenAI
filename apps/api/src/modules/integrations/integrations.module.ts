import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { LeadModule } from '../lead/lead.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { LeadSchema } from '../../schemas/lead.schema';
import { LeadActivitySchema } from '../../schemas/lead-activity.schema';
import { TenantSchema } from '../../schemas/tenant.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Lead', schema: LeadSchema },
      { name: 'LeadActivity', schema: LeadActivitySchema },
      { name: 'Tenant', schema: TenantSchema },
    ]),
    LeadModule,
    ApiKeyModule,
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
