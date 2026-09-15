import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountDeletionController } from './account-deletion.controller';
import { AccountDeletionService } from './account-deletion.service';
import { AccountDeletionRequestSchema } from '../../schemas/account-deletion-request.schema';
import { TenantSchema } from '../../schemas/tenant.schema';
import { UserSchema } from '../../schemas/user.schema';
import { RefreshTokenSchema } from '../../schemas/refresh-token.schema';
import { NotificationSchema } from '../../schemas/notification.schema';
import { GatewayModule } from '../../gateways/gateway.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'AccountDeletionRequest', schema: AccountDeletionRequestSchema },
      { name: 'Tenant', schema: TenantSchema },
      { name: 'User', schema: UserSchema },
      { name: 'RefreshToken', schema: RefreshTokenSchema },
      { name: 'Notification', schema: NotificationSchema },
    ]),
    GatewayModule,
  ],
  controllers: [AccountDeletionController],
  providers: [AccountDeletionService],
  exports: [AccountDeletionService],
})
export class AccountDeletionModule {}
