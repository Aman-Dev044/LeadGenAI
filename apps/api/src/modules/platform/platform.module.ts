import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlatformSettingsSchema } from '../../schemas/platform-settings.schema';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformController } from './platform.controller';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: 'PlatformSettings', schema: PlatformSettingsSchema }])],
  controllers: [PlatformController],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class PlatformModule {}
