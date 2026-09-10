import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators';
import { PlatformSettingsService } from './platform-settings.service';

/** Non-sensitive platform status for the dashboard and login page (banner, maintenance). */
@Controller('platform')
export class PlatformController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Public()
  @Get('status')
  status() {
    const s = this.settings.get();
    return {
      platformName: s.platformName || 'LeadAI',
      supportEmail: s.supportEmail || '',
      maintenanceMode: !!s.maintenanceMode,
      maintenanceMessage: s.maintenanceMode ? this.settings.maintenanceMessage() : undefined,
      signupEnabled: this.settings.isSignupEnabled(),
      announcement: this.settings.activeAnnouncement(),
    };
  }
}
