import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CredentialsService } from './credentials.service';
import { CredentialTesterService } from './credential-tester.service';
import { CREDENTIAL_PROVIDER_IDS } from './credential-providers';
import { CurrentTenant, CurrentUser, Roles } from '../../common/decorators';
import { UpsertCredentialDto } from './dto';
import { EMAIL_PROVIDER } from '../../providers/email/email.module';
import { IEmailProvider } from '../../common/interfaces';

type Actor = { userId: string; role: string };

/**
 * Per-workspace API credentials.
 *
 * Admin-only, and deliberately write-only for anything secret: no response from
 * this controller ever contains a usable key. Reads return a mask, so a stored
 * secret cannot be recovered from the browser, the network tab or page source -
 * only replaced.
 */
@ApiTags('credentials')
@Controller('credentials')
@Roles('ADMIN')
export class CredentialsController {
  constructor(
    private readonly service: CredentialsService,
    private readonly tester: CredentialTesterService,
    @Inject(EMAIL_PROVIDER) private readonly email: IEmailProvider,
  ) {}

  /** Credentials belong to one workspace; the owner must pick one first. */
  private requireTenant(tenantId: string): string {
    if (!tenantId || tenantId === 'all') {
      throw new BadRequestException(
        'Select a workspace first - API credentials belong to a single tenant.',
      );
    }
    return tenantId;
  }

  private requireProvider(id: string): string {
    if (!CREDENTIAL_PROVIDER_IDS.includes(id)) {
      throw new BadRequestException(`Unknown integration "${id}"`);
    }
    return id;
  }

  @Get()
  list(@CurrentTenant() tenantId: string) {
    return this.service.describeAll(tenantId);
  }

  @Put(':provider')
  upsert(
    @CurrentTenant() tenantId: string,
    @Param('provider') provider: string,
    @Body() dto: UpsertCredentialDto,
    @CurrentUser() user: Actor,
  ) {
    return this.service.upsert(
      this.requireTenant(tenantId),
      this.requireProvider(provider),
      { ...(dto.values || {}), ...(dto.enabled === undefined ? {} : { enabled: dto.enabled }) },
      user?.userId,
    );
  }

  @Post(':provider/test')
  test(@CurrentTenant() tenantId: string, @Param('provider') provider: string) {
    return this.tester.test(this.requireTenant(tenantId), this.requireProvider(provider));
  }

  /**
   * Sends a real e-mail through whatever this workspace is configured to use,
   * so an admin can see the sender address their customers will see.
   */
  @Post('smtp/send-test')
  async sendTestEmail(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: Actor,
    @Body('to') to?: string,
  ) {
    const id = this.requireTenant(tenantId);
    const recipient = (to || '').trim();
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      throw new BadRequestException('Enter the address the test e-mail should go to');
    }
    const result = await this.email.sendEmail({
      tenantId: id,
      to: recipient,
      subject: 'LeadBells test e-mail',
      html:
        '<div style="font-family:Arial,sans-serif;max-width:560px">' +
        '<h2 style="margin:0 0 12px">Your e-mail settings work ✅</h2>' +
        '<p style="color:#444">This test was sent from your workspace\'s own mail server. Every alert, appointment confirmation and follow-up your customers receive will come from this same address.</p>' +
        '<p style="color:#888;font-size:12px">Sent by LeadBells.</p></div>',
    });
    if (!result.success) {
      return { ok: false, message: `Could not send to ${recipient}. Check the host, port, username and password.` };
    }
    return { ok: true, message: `Test e-mail sent to ${recipient}.` };
  }

  /** Removes this workspace's overrides; the platform defaults take over again. */
  @Delete(':provider')
  clear(@CurrentTenant() tenantId: string, @Param('provider') provider: string) {
    return this.service.clear(this.requireTenant(tenantId), this.requireProvider(provider));
  }
}
